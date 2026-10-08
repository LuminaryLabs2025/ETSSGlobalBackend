import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  Booking,
  BookingTimelineEntry,
  Incident,
} from '../../database/entities';
import { toCsv } from '../../common/utils/query-helpers';
import { resolveDateRange } from '../../common/utils/date-range';
import { LiveTrucksService } from './live-trucks.service';
import { LiveLocationsService } from './live-locations.service';
import {
  EmergencyType,
  PARK_TYPE_LABELS,
  formatMinutes,
} from './traffic-command.constants';
import {
  QueryCancelledBookingsDto,
  QueryEmergenciesDto,
  QueryOccDto,
} from './dto/traffic-command.dto';

const HOUR_MS = 60 * 60 * 1000;
const EMERGENCY_FETCH_CAP = 500;
const INCIDENT_EMERGENCY_TYPES: Record<string, EmergencyType> = {
  TRUCK_BREAKDOWN: 'BREAKDOWN',
  ACCIDENT_INJURY: 'ACCIDENT',
};
const INCIDENT_CLOSED_STATUSES = ['RESOLVED', 'CLOSED'];

/**
 * Operations Command Centre (MVP 088) — platform-wide operational picture
 * built from bookings, barrier tags and incidents. Period filters default
 * to the last 7 days.
 */
@Injectable()
export class OccService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    private readonly liveTrucksService: LiveTrucksService,
    private readonly liveLocationsService: LiveLocationsService,
  ) {}

  async overview(query: QueryOccDto) {
    const range = this.periodRange(query);
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * HOUR_MS);
    const [
      trucks,
      sites,
      occupancy,
      atat,
      tatByCategory,
      destinations,
      terminalArrivals,
      terminalHourly,
      emergencies,
      cancelled,
    ] = await Promise.all([
      this.liveTrucksService.summary({}),
      this.liveLocationsService.loadSites(),
      this.liveLocationsService.occupancy(since24h),
      this.liveLocationsService.atatMinutes(range.from ?? since24h),
      this.facilityTatByCategory(range),
      this.truckDestinations(),
      this.terminalArrivals(range),
      this.terminalHourlyArrivals(),
      this.emergencyCounts(),
      this.cancelledCount(range),
    ]);

    const key = (type: string, id: string) => `${type}:${id}`;
    const capacityRow = (s: (typeof sites)[number]) => {
      const occupied = occupancy.get(key(s.site_type, s.id)) ?? 0;
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        kind: s.kind,
        park_type: s.park_type,
        park_type_label: PARK_TYPE_LABELS[s.park_type] ?? s.park_type,
        capacity: s.capacity ?? 0,
        occupied,
        utilisation_percentage: s.capacity
          ? Math.round((occupied / s.capacity) * 1000) / 10
          : null,
      };
    };
    const active = sites.filter((s) => s.status === 'ACTIVE');

    return {
      period: { from: range.from ?? null, to: range.to ?? null },
      trucks,
      facility_capacity: active
        .filter((s) => s.site_type === 'FACILITY')
        .map(capacityRow),
      transit_park_capacity: active
        .filter((s) => s.site_type === 'TRANSIT_PARK')
        .map(capacityRow),
      facility_tat_by_category: tatByCategory,
      truck_destinations: destinations,
      terminals: active
        .filter((s) => s.site_type === 'TERMINAL')
        .map((s) => {
          const minutes = atat.get(key('TERMINAL', s.id)) ?? null;
          return {
            id: s.id,
            name: s.name,
            code: s.code,
            approved_daily_truck_capacity: s.capacity,
            trucks_arrived: terminalArrivals.get(s.id) ?? 0,
            trucks_in_terminal: occupancy.get(key('TERMINAL', s.id)) ?? 0,
            atat_minutes: minutes === null ? null : Math.round(minutes),
            atat_label: formatMinutes(minutes),
          };
        }),
      terminal_hourly_arrivals: terminalHourly,
      emergencies,
      cancelled_bookings: cancelled,
      last_updated: now,
    };
  }

  /** Tow truck requests (bookings) + truck breakdown / accident incidents. */
  async emergencies(query: QueryEmergenciesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const range = resolveDateRange(query);
    const search = query.search?.trim();

    const wantTow =
      !query.emergency_type || query.emergency_type === 'TOW_TRUCK';
    const incidentTypes = Object.entries(INCIDENT_EMERGENCY_TYPES)
      .filter(([, t]) => !query.emergency_type || t === query.emergency_type)
      .map(([type]) => type);

    const towQb = this.bookingRepository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.facility', 'f')
      .leftJoinAndSelect('b.transit_park', 'tp')
      .where('b.tow_requested_at IS NOT NULL');
    const incidentQb = this.incidentRepository
      .createQueryBuilder('i')
      .where('i.type IN (:...types)', {
        types: incidentTypes.length ? incidentTypes : ['__none__'],
      });
    if (range.from) {
      towQb.andWhere('b.tow_requested_at >= :from', { from: range.from });
      incidentQb.andWhere('i.reported_at >= :from', { from: range.from });
    }
    if (range.to) {
      towQb.andWhere('b.tow_requested_at <= :to', { to: range.to });
      incidentQb.andWhere('i.reported_at <= :to', { to: range.to });
    }
    if (query.active === true) {
      towQb.andWhere("COALESCE(b.tow_status, 'PENDING') <> 'COMPLETED'");
      incidentQb.andWhere('i.status NOT IN (:...closed)', {
        closed: INCIDENT_CLOSED_STATUSES,
      });
    } else if (query.active === false) {
      towQb.andWhere("b.tow_status = 'COMPLETED'");
      incidentQb.andWhere('i.status IN (:...closed)', {
        closed: INCIDENT_CLOSED_STATUSES,
      });
    }
    if (search) {
      towQb.andWhere(
        new Brackets((w) =>
          w
            .where('b.truck_plate_number ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('b.driver_name ILIKE :search')
            .orWhere('b.booking_id ILIKE :search'),
        ),
      );
      incidentQb.andWhere(
        new Brackets((w) =>
          w
            .where('i.truck_plate_number ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('i.driver_name ILIKE :search')
            .orWhere('i.reference_id ILIKE :search'),
        ),
      );
    }

    const [tows, incidents] = await Promise.all([
      wantTow
        ? towQb
            .orderBy('b.tow_requested_at', 'DESC')
            .take(EMERGENCY_FETCH_CAP)
            .getMany()
        : Promise.resolve([] as Booking[]),
      incidentTypes.length
        ? incidentQb
            .orderBy('i.reported_at', 'DESC')
            .take(EMERGENCY_FETCH_CAP)
            .getMany()
        : Promise.resolve([] as Incident[]),
    ]);

    const rows = [
      ...tows.map((b) => ({
        id: b.id,
        source: 'BOOKING_TOW_REQUEST' as const,
        emergency_type: 'TOW_TRUCK' as EmergencyType,
        reference: b.booking_id,
        booking_id: b.booking_id,
        truck_plate_number: b.truck_plate_number,
        driver_name: b.driver_name,
        driver_id: b.driver_id,
        current_location:
          b.facility?.name ?? b.transit_park?.name ?? b.terminal_name,
        timestamp: b.tow_requested_at!,
        status: b.tow_status ?? 'PENDING',
        active: (b.tow_status ?? 'PENDING') !== 'COMPLETED',
        details: b.tow_reason,
        tow_company: b.tow_company,
      })),
      ...incidents.map((i) => ({
        id: i.id,
        source: 'INCIDENT' as const,
        emergency_type: INCIDENT_EMERGENCY_TYPES[i.type],
        reference: i.reference_id,
        booking_id: i.booking_reference,
        truck_plate_number: i.truck_plate_number,
        driver_name: i.driver_name,
        driver_id: null,
        current_location: i.location_name,
        timestamp: i.reported_at,
        status: i.status,
        active: !INCIDENT_CLOSED_STATUSES.includes(i.status),
        details: i.description,
        tow_company: null,
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = rows.length;
    return {
      summary: {
        total,
        active: rows.filter((r) => r.active).length,
        by_type: {
          TOW_TRUCK: rows.filter((r) => r.emergency_type === 'TOW_TRUCK')
            .length,
          BREAKDOWN: rows.filter((r) => r.emergency_type === 'BREAKDOWN')
            .length,
          ACCIDENT: rows.filter((r) => r.emergency_type === 'ACCIDENT').length,
        },
      },
      data: rows.slice((page - 1) * limit, page * limit),
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  async cancelledBookings(query: QueryCancelledBookingsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.cancelledQuery(resolveDateRange(query), query.search);
    const total = await qb.clone().getCount();
    const rows = await qb
      .orderBy('cancelled_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<CancelledRow>();
    return {
      data: rows.map((r) => this.mapCancelled(r)),
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  async exportCancelledBookings(query: QueryCancelledBookingsDto) {
    const rows = await this.cancelledQuery(
      resolveDateRange(query),
      query.search,
    )
      .orderBy('cancelled_at', 'DESC')
      .limit(10_000)
      .getRawMany<CancelledRow>();
    return toCsv([
      [
        'Booking ID',
        'Plate Number',
        'Driver',
        'Category',
        'Booking Type',
        'Location',
        'Reason',
        'Cancelled By',
        'Cancelled At',
      ],
      ...rows.map((r) => {
        const m = this.mapCancelled(r);
        return [
          m.booking_id,
          m.truck_plate_number,
          m.driver_name,
          m.category,
          m.booking_type,
          m.location_name,
          m.reason,
          m.cancelled_by,
          m.cancelled_at ? new Date(m.cancelled_at).toISOString() : '',
        ];
      }),
    ]);
  }

  // ─────────────────────────────────────────────────────────────────────

  private periodRange(query: QueryOccDto) {
    return resolveDateRange({
      ...query,
      date_preset:
        query.date_preset ?? (query.date_from ? undefined : 'WEEKLY'),
    });
  }

  private async facilityTatByCategory(range: { from?: Date; to?: Date }) {
    const qb = this.bookingRepository
      .createQueryBuilder('b')
      .select('b.booking_category', 'category')
      .addSelect(
        'AVG(EXTRACT(EPOCH FROM (COALESCE(b.left_facility_at, b.gtg_facility_at) - b.in_facility_at)) / 60)',
        'minutes',
      )
      .addSelect('COUNT(*)', 'trucks')
      .where('b.in_facility_at IS NOT NULL')
      .andWhere('COALESCE(b.left_facility_at, b.gtg_facility_at) IS NOT NULL');
    if (range.from)
      qb.andWhere('b.in_facility_at >= :from', { from: range.from });
    if (range.to) qb.andWhere('b.in_facility_at <= :to', { to: range.to });
    const rows = await qb
      .groupBy('b.booking_category')
      .getRawMany<{ category: string; minutes: string; trucks: string }>();
    return rows.map((r) => ({
      category: r.category,
      minutes: Math.round(Number(r.minutes)),
      label: formatMinutes(Number(r.minutes)),
      trucks: Number(r.trucks),
    }));
  }

  private async truckDestinations() {
    const rows = await this.bookingRepository
      .createQueryBuilder('b')
      .select("COALESCE(NULLIF(b.terminal_name, ''), 'Unspecified')", 'name')
      .addSelect('COUNT(*)', 'value')
      .where("b.status = 'LIVE'")
      .groupBy('name')
      .orderBy('value', 'DESC')
      .getRawMany<{ name: string; value: string }>();
    return rows.map((r) => ({ name: r.name, value: Number(r.value) }));
  }

  private async terminalArrivals(range: { from?: Date; to?: Date }) {
    const qb = this.bookingRepository
      .createQueryBuilder('b')
      .select('b.terminal_id', 'terminal_id')
      .addSelect('COUNT(*)', 'count')
      .where('b.in_terminal_at IS NOT NULL')
      .andWhere('b.terminal_id IS NOT NULL');
    if (range.from)
      qb.andWhere('b.in_terminal_at >= :from', { from: range.from });
    if (range.to) qb.andWhere('b.in_terminal_at <= :to', { to: range.to });
    const rows = await qb
      .groupBy('b.terminal_id')
      .getRawMany<{ terminal_id: string; count: string }>();
    return new Map(rows.map((r) => [r.terminal_id, Number(r.count)]));
  }

  /** Trucks arriving at each terminal per hour over the last 24 hours. */
  private async terminalHourlyArrivals() {
    const since = new Date(Date.now() - 24 * HOUR_MS);
    const rows = await this.bookingRepository
      .createQueryBuilder('b')
      .select("date_trunc('hour', b.in_terminal_at)", 'hour')
      .addSelect('b.terminal_id', 'terminal_id')
      .addSelect('MAX(b.terminal_name)', 'terminal_name')
      .addSelect('COUNT(*)', 'trucks')
      .where('b.in_terminal_at >= :since', { since })
      .groupBy('hour')
      .addGroupBy('b.terminal_id')
      .orderBy('hour', 'ASC')
      .getRawMany<{
        hour: Date;
        terminal_id: string;
        terminal_name: string;
        trucks: string;
      }>();
    return rows.map((r) => ({
      hour: r.hour,
      terminal_id: r.terminal_id,
      terminal_name: r.terminal_name,
      trucks: Number(r.trucks),
    }));
  }

  private async emergencyCounts() {
    const [towActive, incidents] = await Promise.all([
      this.bookingRepository
        .createQueryBuilder('b')
        .where('b.tow_requested_at IS NOT NULL')
        .andWhere("COALESCE(b.tow_status, 'PENDING') <> 'COMPLETED'")
        .getCount(),
      this.incidentRepository
        .createQueryBuilder('i')
        .select('i.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('i.type IN (:...types)', {
          types: Object.keys(INCIDENT_EMERGENCY_TYPES),
        })
        .andWhere('i.status NOT IN (:...closed)', {
          closed: INCIDENT_CLOSED_STATUSES,
        })
        .groupBy('i.type')
        .getRawMany<{ type: string; count: string }>(),
    ]);
    const byType = new Map(incidents.map((r) => [r.type, Number(r.count)]));
    return {
      active_tow_requests: towActive,
      active_breakdowns: byType.get('TRUCK_BREAKDOWN') ?? 0,
      active_accidents: byType.get('ACCIDENT_INJURY') ?? 0,
    };
  }

  private async cancelledCount(range: { from?: Date; to?: Date }) {
    return { total: await this.cancelledQuery(range).getCount() };
  }

  private cancelledQuery(range: { from?: Date; to?: Date }, search?: string) {
    const cancelledAt = 'COALESCE(ct.created_at, b.last_updated_at)';
    const qb = this.bookingRepository
      .createQueryBuilder('b')
      .leftJoin(
        BookingTimelineEntry,
        'ct',
        "ct.booking_id = b.id AND ct.status = 'CANCELLED'",
      )
      .leftJoin('b.facility', 'f')
      .leftJoin('b.transit_park', 'tp')
      .select('b.id', 'id')
      .addSelect('b.booking_id', 'booking_id')
      .addSelect('b.truck_plate_number', 'truck_plate_number')
      .addSelect('b.driver_name', 'driver_name')
      .addSelect('b.booking_category', 'category')
      .addSelect('b.booking_type', 'booking_type')
      .addSelect('COALESCE(f.name, tp.name)', 'location_name')
      .addSelect('ct.notes', 'reason')
      .addSelect('ct.performed_by', 'cancelled_by')
      .addSelect(cancelledAt, 'cancelled_at')
      .where("b.status = 'CANCELLED'");
    if (range.from)
      qb.andWhere(`${cancelledAt} >= :from`, { from: range.from });
    if (range.to) qb.andWhere(`${cancelledAt} <= :to`, { to: range.to });
    search = search?.trim();
    if (search) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('b.booking_id ILIKE :search', { search: `%${search}%` })
            .orWhere('b.truck_plate_number ILIKE :search')
            .orWhere('b.driver_name ILIKE :search'),
        ),
      );
    }
    return qb;
  }

  private mapCancelled(r: CancelledRow) {
    return {
      id: r.id,
      booking_id: r.booking_id,
      truck_plate_number: r.truck_plate_number,
      driver_name: r.driver_name,
      category: r.category,
      booking_type: r.booking_type,
      location_name: r.location_name,
      reason: r.reason,
      cancelled_by: r.cancelled_by,
      cancelled_at: r.cancelled_at,
    };
  }
}

type CancelledRow = {
  id: string;
  booking_id: string;
  truck_plate_number: string;
  driver_name: string;
  category: string;
  booking_type: string | null;
  location_name: string | null;
  reason: string | null;
  cancelled_by: string | null;
  cancelled_at: Date;
};
