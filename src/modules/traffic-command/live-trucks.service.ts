import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Booking } from '../../database/entities';
import {
  LIVE_TRUCK_STAGES,
  LIVE_TRUCK_STAGE_GROUP,
  LIVE_TRUCK_STAGE_LABELS,
  LiveTruckStage,
  PARK_TYPE_LABELS,
  stageSinceSql,
  stageSql,
} from './traffic-command.constants';
import {
  QueryLiveTruckMatrixDto,
  QueryLiveTrucksDto,
} from './dto/traffic-command.dto';

const STAGE = stageSql('b');
const SINCE = stageSinceSql('b');
const LOCATION_ID = 'COALESCE(b.facility_id, b.transit_park_id)';
const LOCATION_TYPE = `(CASE WHEN b.facility_id IS NOT NULL THEN 'FACILITY' ELSE 'TRANSIT_PARK' END)`;

type TruckRow = {
  id: string;
  booking_id: string;
  truck_plate_number: string;
  driver_name: string;
  driver_id: string;
  transporter_company: string;
  terminal_name: string;
  booking_type: string | null;
  stage: LiveTruckStage;
  since: Date;
  location_id: string | null;
  location_type: string;
  location_name: string | null;
};

/**
 * TCCM > Live Truck Updates (MVP 086). Every LIVE booking is one truck on
 * the board; its column is derived from the booking lifecycle timestamps
 * (see stageSql), its row from the facility / EPT it was booked into.
 */
@Injectable()
export class LiveTrucksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {}

  /** Dashboard cards: Total, On-Trip, Left-Facility, Left-Pregate, In-Terminal (+ count per stage). */
  async summary(query: QueryLiveTrucksDto) {
    const rows = await this.baseQuery(query)
      .select(STAGE, 'stage')
      .addSelect('COUNT(*)', 'count')
      .groupBy('stage')
      .getRawMany<{ stage: LiveTruckStage; count: string }>();
    const counts = new Map(rows.map((r) => [r.stage, Number(r.count)]));
    const count = (stage: LiveTruckStage) => counts.get(stage) ?? 0;
    const total = rows.reduce((acc, r) => acc + Number(r.count), 0);
    return {
      total_bookings: total,
      on_trip:
        count('ENROUTE_FACILITY') +
        count('ENROUTE_PREGATE') +
        count('ENROUTE_TERMINAL'),
      left_facility: count('ENROUTE_PREGATE'),
      left_pregate: count('ENROUTE_TERMINAL'),
      in_terminal: count('IN_TERMINAL'),
      by_stage: LIVE_TRUCK_STAGES.map((stage) => ({
        stage,
        label: LIVE_TRUCK_STAGE_LABELS[stage],
        count: count(stage),
      })),
      last_updated: new Date(),
    };
  }

  /** "Truck Real-Time Activity" — one row per location, one cell per stage. */
  async matrix(query: QueryLiveTruckMatrixDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const cellLimit = query.cell_limit ?? 2;

    const groups = this.baseQuery(query)
      .andWhere('(b.facility_id IS NOT NULL OR b.transit_park_id IS NOT NULL)')
      .select(LOCATION_ID, 'location_id')
      .addSelect(LOCATION_TYPE, 'location_type')
      .addSelect('MAX(COALESCE(f.name, tp.name))', 'location_name')
      .addSelect(
        'MAX(COALESCE(f.facility_code, tp.transit_park_code))',
        'location_code',
      )
      .addSelect(
        'MAX(COALESCE(f.park_type, tp.transit_park_type))',
        'park_type',
      )
      .addSelect('COUNT(*)', 'total')
      .groupBy(LOCATION_ID)
      .addGroupBy(LOCATION_TYPE);

    const [groupSql, groupParams] = groups.getQueryAndParameters();
    const [{ total }] = await this.dataSource.query<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM (${groupSql}) g`,
      groupParams,
    );

    const locations = await groups
      .orderBy('MAX(COALESCE(f.name, tp.name))', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<{
        location_id: string;
        location_type: string;
        location_name: string;
        location_code: string;
        park_type: string;
        total: string;
      }>();

    const trucksByLocation = new Map<string, TruckRow[]>();
    if (locations.length) {
      const trucks = await this.truckRows(
        this.baseQuery(query).andWhere(`${LOCATION_ID} IN (:...locationIds)`, {
          locationIds: locations.map((l) => l.location_id),
        }),
      ).getRawMany<TruckRow>();
      for (const truck of trucks) {
        const list = trucksByLocation.get(truck.location_id!) ?? [];
        list.push(truck);
        trucksByLocation.set(truck.location_id!, list);
      }
    }

    return {
      columns: LIVE_TRUCK_STAGES.map((stage) => ({
        stage,
        label: LIVE_TRUCK_STAGE_LABELS[stage],
      })),
      data: locations.map((location, i) => {
        const trucks = trucksByLocation.get(location.location_id) ?? [];
        return {
          s_no: (page - 1) * limit + i + 1,
          location: {
            id: location.location_id,
            type: location.location_type,
            name: location.location_name,
            code: location.location_code,
            park_type: location.park_type,
            park_type_label:
              PARK_TYPE_LABELS[location.park_type] ?? location.park_type,
          },
          total: Number(location.total),
          stages: LIVE_TRUCK_STAGES.map((stage) => {
            const inStage = trucks.filter((t) => t.stage === stage);
            return {
              stage,
              label: LIVE_TRUCK_STAGE_LABELS[stage],
              count: inStage.length,
              trucks: inStage.slice(0, cellLimit).map((t) => ({
                booking_uuid: t.id,
                booking_id: t.booking_id,
                truck_plate_number: t.truck_plate_number,
                driver_name: t.driver_name,
                since: t.since,
              })),
              more: Math.max(0, inStage.length - cellLimit),
            };
          }),
        };
      }),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
      last_updated: new Date(),
    };
  }

  /** Flat truck list (the "By Status" / "By Route" tables). */
  async list(query: QueryLiveTrucksDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.baseQuery(query);
    const total = await qb.clone().getCount();
    const rows = await this.truckRows(qb)
      .orderBy(SINCE, 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<TruckRow>();
    return {
      data: rows.map((row) => this.mapTruck(row)),
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────────────────────────────

  private baseQuery(query: QueryLiveTrucksDto): SelectQueryBuilder<Booking> {
    const qb = this.bookingRepository
      .createQueryBuilder('b')
      .leftJoin('b.facility', 'f')
      .leftJoin('b.transit_park', 'tp')
      .where("b.status = 'LIVE'");
    if (query.booking_type) {
      qb.andWhere('b.booking_type = :bookingType', {
        bookingType: query.booking_type,
      });
    }
    if (query.location_id) {
      qb.andWhere(`${LOCATION_ID} = :locationId`, {
        locationId: query.location_id,
      });
    }
    if (query.stage) {
      qb.andWhere(`${STAGE} = :stage`, { stage: query.stage });
    }
    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('b.truck_plate_number ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('b.booking_id ILIKE :search')
            .orWhere('b.driver_name ILIKE :search');
        }),
      );
    }
    return qb;
  }

  private truckRows(qb: SelectQueryBuilder<Booking>) {
    return qb
      .select('b.id', 'id')
      .addSelect('b.booking_id', 'booking_id')
      .addSelect('b.truck_plate_number', 'truck_plate_number')
      .addSelect('b.driver_name', 'driver_name')
      .addSelect('b.driver_id', 'driver_id')
      .addSelect('b.transporter_company', 'transporter_company')
      .addSelect('b.terminal_name', 'terminal_name')
      .addSelect('b.booking_type', 'booking_type')
      .addSelect(STAGE, 'stage')
      .addSelect(SINCE, 'since')
      .addSelect(LOCATION_ID, 'location_id')
      .addSelect(LOCATION_TYPE, 'location_type')
      .addSelect('COALESCE(f.name, tp.name)', 'location_name')
      .orderBy(SINCE, 'ASC');
  }

  private mapTruck(row: TruckRow) {
    const location = row.location_name ?? 'Facility';
    const terminal = row.terminal_name || 'Terminal';
    const where: Record<LiveTruckStage, [string, string]> = {
      ENROUTE_FACILITY: [`En route to ${location}`, location],
      IN_FACILITY: [location, 'Pregate'],
      MATCHED: [location, 'Pregate'],
      GTG_FACILITY: [location, 'Pregate'],
      ENROUTE_PREGATE: ['En route to Pregate', 'Pregate'],
      IN_PREGATE: ['Pregate', terminal],
      GTG_PREGATE: ['Pregate', terminal],
      ENROUTE_TERMINAL: [`En route to ${terminal}`, terminal],
      IN_TERMINAL: [terminal, terminal],
    };
    const [currentLocation, destination] = where[row.stage];
    return {
      booking_uuid: row.id,
      booking_id: row.booking_id,
      truck_plate_number: row.truck_plate_number,
      driver_name: row.driver_name,
      driver_id: row.driver_id,
      transporter_company: row.transporter_company,
      booking_type: row.booking_type,
      location: row.location_id
        ? {
            id: row.location_id,
            type: row.location_type,
            name: row.location_name,
          }
        : null,
      terminal_name: row.terminal_name,
      stage: row.stage,
      stage_label: LIVE_TRUCK_STAGE_LABELS[row.stage],
      stage_group: LIVE_TRUCK_STAGE_GROUP[row.stage],
      since: row.since,
      current_location: currentLocation,
      destination,
    };
  }
}
