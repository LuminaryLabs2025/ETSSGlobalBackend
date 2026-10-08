import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  Barrier,
  BarrierSiteLink,
  BarrierTagEvent,
  Booking,
  Facility,
  HandheldDevice,
  RfidTag,
  Terminal,
  TransitPark,
  Truck,
} from '../../database/entities';
import { paginateQueryBuilder } from '../../common/utils/query-helpers';
import { resolveDateRange } from '../../common/utils/date-range';
import { BookingsService } from '../bookings/bookings.service';
import {
  FACILITY_STAGES,
  LOCATION_KIND_LABELS,
  LocationKind,
  PARK_TYPE_LABELS,
  formatMinutes,
  stageSql,
} from './traffic-command.constants';
import {
  CreateBarrierTagEventDto,
  QueryBarrierTagEventsDto,
  QueryLiveLocationsDto,
} from './dto/traffic-command.dto';

type SiteType = 'FACILITY' | 'TRANSIT_PARK' | 'TERMINAL';

export type TrafficActor = {
  id: string;
  first_name?: string;
  last_name?: string;
  is_super_admin?: boolean;
  permissions?: string[];
};

interface Site {
  site_type: SiteType;
  id: string;
  name: string;
  code: string;
  kind: LocationKind;
  park_type: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  capacity: number | null;
}

const HOUR_MS = 60 * 60 * 1000;
const siteKey = (type: string, id: string) => `${type}:${id}`;

/**
 * TCCM > Live Location Updates (MVP 087): every Facility, Facility-Pregate,
 * Pregate, EPT and Terminal with its coordinates, gate barrier status,
 * trucks tagged in the last hour and ATAT — plus ingestion of the barrier
 * tag events those metrics come from.
 */
@Injectable()
export class LiveLocationsService {
  private readonly logger = new Logger(LiveLocationsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(TransitPark)
    private readonly transitParkRepository: Repository<TransitPark>,
    @InjectRepository(Terminal)
    private readonly terminalRepository: Repository<Terminal>,
    @InjectRepository(Barrier)
    private readonly barrierRepository: Repository<Barrier>,
    @InjectRepository(BarrierSiteLink)
    private readonly siteLinkRepository: Repository<BarrierSiteLink>,
    @InjectRepository(BarrierTagEvent)
    private readonly tagEventRepository: Repository<BarrierTagEvent>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Truck)
    private readonly truckRepository: Repository<Truck>,
    @InjectRepository(RfidTag)
    private readonly rfidTagRepository: Repository<RfidTag>,
    @InjectRepository(HandheldDevice)
    private readonly handheldDeviceRepository: Repository<HandheldDevice>,
    private readonly bookingsService: BookingsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // Map
  // ─────────────────────────────────────────────────────────────────────

  async locations(query: QueryLiveLocationsDto) {
    const sites = await this.loadSites();
    const now = new Date();
    const [links, tagCounts, atat, occupancy] = await Promise.all([
      this.siteLinkRepository.find({ relations: ['barrier'] }),
      this.tagCountsSince(new Date(now.getTime() - HOUR_MS)),
      this.atatMinutes(new Date(now.getTime() - 24 * HOUR_MS)),
      this.occupancy(new Date(now.getTime() - 24 * HOUR_MS)),
    ]);

    const linksBySite = new Map<string, BarrierSiteLink[]>();
    for (const link of links) {
      const key = siteKey(link.site_type, link.site_id);
      linksBySite.set(key, [...(linksBySite.get(key) ?? []), link]);
    }

    const all = sites.map((site) => {
      const key = siteKey(site.site_type, site.id);
      const siteLinks = linksBySite.get(key) ?? [];
      const gate = (role: 'ENTRY' | 'EXIT') => {
        const barriers = siteLinks
          .filter((l) => l.barrier_role === role && l.barrier)
          .map((l) => {
            const live =
              l.barrier.status === 'ACTIVE' &&
              l.barrier.operational_status === 'ONLINE';
            return {
              id: l.barrier.id,
              barrier_id_number: l.barrier.barrier_id_number,
              service_provider_name: l.barrier.service_provider_name,
              operational_status: l.barrier.operational_status,
              status: l.barrier.status,
              online: live,
              trucks_tagged_last_hour:
                tagCounts.get(`${key}:${l.barrier.id}:${role}`) ?? 0,
            };
          });
        return {
          status: !barriers.length
            ? 'NOT_CONFIGURED'
            : barriers.some((b) => b.online)
              ? 'ONLINE'
              : 'OFFLINE',
          online: barriers.some((b) => b.online),
          trucks_tagged_last_hour: barriers.reduce(
            (acc, b) => acc + b.trucks_tagged_last_hour,
            0,
          ),
          barriers,
        };
      };
      const entryGate = gate('ENTRY');
      const exitGate = gate('EXIT');
      const atatMinutes = atat.get(key) ?? null;
      return {
        id: site.id,
        site_type: site.site_type,
        kind: site.kind,
        kind_label: LOCATION_KIND_LABELS[site.kind],
        name: site.name,
        code: site.code,
        park_type: site.park_type,
        park_type_label: PARK_TYPE_LABELS[site.park_type] ?? site.park_type,
        address: site.address,
        latitude: site.latitude,
        longitude: site.longitude,
        status: site.status,
        online: entryGate.online || exitGate.online,
        capacity: site.capacity,
        trucks_on_site: occupancy.get(key) ?? 0,
        atat_minutes: atatMinutes === null ? null : Math.round(atatMinutes),
        atat_label: formatMinutes(atatMinutes),
        entry_gate: entryGate,
        exit_gate: exitGate,
      };
    });

    const search = query.search?.trim().toLowerCase();
    const visible = all.filter(
      (l) =>
        (!query.kind || l.kind === query.kind) &&
        (!query.park_type || l.park_type === query.park_type) &&
        (query.online === undefined || l.online === query.online) &&
        (!search ||
          l.name.toLowerCase().includes(search) ||
          l.code.toLowerCase().includes(search) ||
          (l.address ?? '').toLowerCase().includes(search)),
    );

    const atats = visible
      .map((l) => l.atat_minutes)
      .filter((m): m is number => m !== null);
    return {
      summary: {
        total_locations: all.length,
        visible: visible.length,
        online: visible.filter((l) => l.online).length,
        offline: visible.filter((l) => !l.online).length,
        with_coordinates: visible.filter(
          (l) => l.latitude !== null && l.longitude !== null,
        ).length,
        by_kind: Object.fromEntries(
          (Object.keys(LOCATION_KIND_LABELS) as LocationKind[]).map((kind) => [
            kind,
            visible.filter((l) => l.kind === kind).length,
          ]),
        ),
        avg_atat_minutes: atats.length
          ? Math.round(atats.reduce((a, b) => a + b, 0) / atats.length)
          : null,
      },
      data: visible,
      last_updated: now,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Barrier tag events
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Records a truck tagged at a barrier and, when it matches the truck's
   * LIVE booking, advances the post-GTG stages: EXIT at a Pregate (after
   * GTG-Pregate) → left-pregate; EXIT at the booked facility/EPT (after
   * GTG-Facility) → left-facility; ENTRY at the destination terminal →
   * in-terminal. Callers: SuperAdmin / manage_traffic_command holders, or
   * the user an ACTIVE handheld device on this barrier is assigned to.
   */
  async recordTagEvent(dto: CreateBarrierTagEventDto, actor: TrafficActor) {
    const barrier = await this.resolveBarrier(dto);
    await this.assertCanTag(barrier, actor);
    const link = this.resolveSiteLink(barrier, dto);
    const { plate, truck, rfid } = await this.resolveTruck(dto);
    const taggedAt = dto.tagged_at ? new Date(dto.tagged_at) : new Date();

    const booking = await this.bookingRepository
      .createQueryBuilder('b')
      .where("b.status = 'LIVE'")
      .andWhere(
        truck
          ? '(b.truck_id = :truckId OR b.truck_plate_number = :plate)'
          : 'b.truck_plate_number = :plate',
        { truckId: truck?.id, plate },
      )
      .orderBy('b.created_at', 'DESC')
      .getOne();

    let transition: string | null = null;
    let transitionError: string | null = null;
    if (booking) {
      try {
        transition = await this.applyTransition(
          booking,
          link,
          taggedAt,
          barrier,
          actor,
        );
      } catch (error) {
        transitionError =
          error instanceof Error ? error.message : 'Transition failed';
        this.logger.warn(
          `Tag ${barrier.barrier_id_number}/${plate} matched booking ${booking.booking_id} but could not advance it: ${transitionError}`,
        );
      }
    }

    const event = await this.tagEventRepository.save(
      this.tagEventRepository.create({
        barrier_id: barrier.id,
        site_type: link.site_type,
        site_id: link.site_id,
        barrier_role: link.barrier_role,
        truck_id: truck?.id ?? null,
        truck_plate_number: plate,
        rfid_tag_number: rfid,
        booking_id: booking?.id ?? null,
        booking_transition: transition,
        source: dto.source ?? 'BARRIER',
        tagged_at: taggedAt,
        recorded_by: actor.id,
      }),
    );

    return {
      ...this.mapTagEvent(event, barrier),
      booking: booking
        ? {
            id: booking.id,
            booking_id: booking.booking_id,
            transition,
            transition_error: transitionError,
          }
        : null,
    };
  }

  async listTagEvents(query: QueryBarrierTagEventsDto) {
    const qb = this.tagEventRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.barrier', 'barrier');
    if (query.barrier_id) {
      qb.andWhere('e.barrier_id = :barrierId', { barrierId: query.barrier_id });
    }
    if (query.site_type) {
      qb.andWhere('e.site_type = :siteType', { siteType: query.site_type });
    }
    if (query.site_id) {
      qb.andWhere('e.site_id = :siteId', { siteId: query.site_id });
    }
    if (query.barrier_role) {
      qb.andWhere('e.barrier_role = :role', { role: query.barrier_role });
    }
    if (query.search?.trim()) {
      qb.andWhere('e.truck_plate_number ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }
    const range = resolveDateRange(query);
    if (range.from) qb.andWhere('e.tagged_at >= :from', { from: range.from });
    if (range.to) qb.andWhere('e.tagged_at <= :to', { to: range.to });
    qb.orderBy('e.tagged_at', 'DESC');

    const result = await paginateQueryBuilder(qb, query.page, query.limit);
    return {
      data: result.data.map((e) => this.mapTagEvent(e, e.barrier)),
      meta: result.meta,
    };
  }

  // ─────────────────────────────────────────────────────────────────────

  async loadSites(): Promise<Site[]> {
    const [facilities, transitParks, terminals] = await Promise.all([
      this.facilityRepository.find({ where: { archived_at: IsNull() } }),
      this.transitParkRepository.find({ where: { archived_at: IsNull() } }),
      this.terminalRepository.find({ where: { archived_at: IsNull() } }),
    ]);
    const coords = (row: {
      latitude: number | null;
      longitude: number | null;
    }) => ({
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
    });
    return [
      ...facilities.map((f) => ({
        site_type: 'FACILITY' as const,
        id: f.id,
        name: f.name,
        code: f.facility_code,
        kind: (f.facility_type === 'FACILITY_PREGATE'
          ? 'FACILITY_PREGATE'
          : 'FACILITY') as LocationKind,
        park_type: f.park_type,
        address: f.address,
        ...coords(f),
        status: f.status,
        capacity: f.approved_truck_capacity,
      })),
      ...transitParks.map((t) => ({
        site_type: 'TRANSIT_PARK' as const,
        id: t.id,
        name: t.name,
        code: t.transit_park_code,
        kind: (t.transit_park_type === 'EPT'
          ? 'EPT'
          : 'PREGATE') as LocationKind,
        park_type: t.transit_park_type,
        address: t.address,
        ...coords(t),
        status: t.status,
        capacity: t.approved_truck_capacity,
      })),
      ...terminals.map((t) => ({
        site_type: 'TERMINAL' as const,
        id: t.id,
        name: t.name,
        code: t.terminal_code,
        kind: 'TERMINAL' as LocationKind,
        park_type: t.terminal_type,
        address: t.address,
        ...coords(t),
        status: t.status,
        capacity: t.approved_daily_truck_capacity,
      })),
    ];
  }

  /** `${site_type}:${site_id}:${barrier_id}:${role}` → tags since `since`. */
  private async tagCountsSince(since: Date): Promise<Map<string, number>> {
    const rows = await this.tagEventRepository
      .createQueryBuilder('e')
      .select('e.site_type', 'site_type')
      .addSelect('e.site_id', 'site_id')
      .addSelect('e.barrier_id', 'barrier_id')
      .addSelect('e.barrier_role', 'barrier_role')
      .addSelect('COUNT(*)', 'count')
      .where('e.tagged_at >= :since', { since })
      .groupBy('e.site_type')
      .addGroupBy('e.site_id')
      .addGroupBy('e.barrier_id')
      .addGroupBy('e.barrier_role')
      .getRawMany<{
        site_type: string;
        site_id: string;
        barrier_id: string;
        barrier_role: string;
        count: string;
      }>();
    return new Map(
      rows.map((r) => [
        `${siteKey(r.site_type, r.site_id)}:${r.barrier_id}:${r.barrier_role}`,
        Number(r.count),
      ]),
    );
  }

  /**
   * Average turnaround time per site (minutes) — each EXIT tag since
   * `since` paired with the same plate's latest prior ENTRY at that site.
   * Facilities/EPTs without tag data fall back to booking timestamps
   * (in-facility → left-facility / GTG-facility).
   */
  async atatMinutes(since: Date): Promise<Map<string, number>> {
    const tagRows = await this.dataSource.query<
      { site_type: string; site_id: string; minutes: string }[]
    >(
      `SELECT x.site_type, x.site_id,
              AVG(EXTRACT(EPOCH FROM (x.tagged_at - en.tagged_at)) / 60) AS minutes
         FROM barrier_tag_events x
         JOIN LATERAL (
           SELECT e.tagged_at FROM barrier_tag_events e
            WHERE e.site_type = x.site_type
              AND e.site_id = x.site_id
              AND e.barrier_role = 'ENTRY'
              AND e.truck_plate_number = x.truck_plate_number
              AND e.tagged_at <= x.tagged_at
              AND e.tagged_at >= x.tagged_at - INTERVAL '3 days'
            ORDER BY e.tagged_at DESC
            LIMIT 1
         ) en ON true
        WHERE x.barrier_role = 'EXIT' AND x.tagged_at >= $1
        GROUP BY x.site_type, x.site_id`,
      [since],
    );

    const bookingRows = await this.bookingRepository
      .createQueryBuilder('b')
      .select(
        "(CASE WHEN b.facility_id IS NOT NULL THEN 'FACILITY' ELSE 'TRANSIT_PARK' END)",
        'site_type',
      )
      .addSelect('COALESCE(b.facility_id, b.transit_park_id)', 'site_id')
      .addSelect(
        'AVG(EXTRACT(EPOCH FROM (COALESCE(b.left_facility_at, b.gtg_facility_at) - b.in_facility_at)) / 60)',
        'minutes',
      )
      .where('b.in_facility_at IS NOT NULL')
      .andWhere('COALESCE(b.left_facility_at, b.gtg_facility_at) >= :since', {
        since,
      })
      .andWhere('(b.facility_id IS NOT NULL OR b.transit_park_id IS NOT NULL)')
      .groupBy('site_type')
      .addGroupBy('site_id')
      .getRawMany<{ site_type: string; site_id: string; minutes: string }>();

    const result = new Map<string, number>();
    for (const row of bookingRows) {
      result.set(siteKey(row.site_type, row.site_id), Number(row.minutes));
    }
    for (const row of tagRows) {
      result.set(siteKey(row.site_type, row.site_id), Number(row.minutes));
    }
    return result;
  }

  /**
   * Trucks currently on site: facilities/EPTs from LIVE bookings in the
   * in-facility stages, terminals from LIVE in-terminal bookings, pregates
   * from barrier tags (plates whose latest tag there since `since` was an ENTRY).
   */
  async occupancy(since: Date): Promise<Map<string, number>> {
    const stage = stageSql('b');
    const [atLocation, atTerminal, tagged] = await Promise.all([
      this.bookingRepository
        .createQueryBuilder('b')
        .select(
          "(CASE WHEN b.facility_id IS NOT NULL THEN 'FACILITY' ELSE 'TRANSIT_PARK' END)",
          'site_type',
        )
        .addSelect('COALESCE(b.facility_id, b.transit_park_id)', 'site_id')
        .addSelect('COUNT(*)', 'count')
        .where("b.status = 'LIVE'")
        .andWhere(`${stage} IN (:...stages)`, { stages: FACILITY_STAGES })
        .andWhere(
          '(b.facility_id IS NOT NULL OR b.transit_park_id IS NOT NULL)',
        )
        .groupBy('site_type')
        .addGroupBy('site_id')
        .getRawMany<{ site_type: string; site_id: string; count: string }>(),
      this.bookingRepository
        .createQueryBuilder('b')
        .select("'TERMINAL'", 'site_type')
        .addSelect('b.terminal_id', 'site_id')
        .addSelect('COUNT(*)', 'count')
        .where("b.status = 'LIVE'")
        .andWhere('b.in_terminal_at IS NOT NULL')
        .andWhere('b.terminal_id IS NOT NULL')
        .groupBy('b.terminal_id')
        .getRawMany<{ site_type: string; site_id: string; count: string }>(),
      this.dataSource.query<
        { site_type: string; site_id: string; count: string }[]
      >(
        `SELECT site_type, site_id, COUNT(*) AS count FROM (
           SELECT DISTINCT ON (site_type, site_id, truck_plate_number)
                  site_type, site_id, barrier_role
             FROM barrier_tag_events
            WHERE tagged_at >= $1
            ORDER BY site_type, site_id, truck_plate_number, tagged_at DESC
         ) latest
         WHERE barrier_role = 'ENTRY' AND site_type = 'TRANSIT_PARK'
         GROUP BY site_type, site_id`,
        [since],
      ),
    ]);
    const result = new Map<string, number>();
    for (const row of [...tagged, ...atLocation, ...atTerminal]) {
      const key = siteKey(row.site_type, row.site_id);
      // EPTs have both booking stages and tags — keep the higher reading.
      result.set(key, Math.max(result.get(key) ?? 0, Number(row.count)));
    }
    return result;
  }

  private async resolveBarrier(
    dto: CreateBarrierTagEventDto,
  ): Promise<Barrier> {
    if (!dto.barrier_id && !dto.barrier_id_number) {
      throw new BadRequestException(
        'barrier_id or barrier_id_number is required',
      );
    }
    const barrier = await this.barrierRepository.findOne({
      where: dto.barrier_id
        ? { id: dto.barrier_id }
        : { barrier_id_number: dto.barrier_id_number!.trim() },
      relations: ['site_links'],
    });
    if (!barrier) throw new NotFoundException('Barrier not found');
    if (barrier.status !== 'ACTIVE') {
      throw new BadRequestException('Barrier is disabled');
    }
    return barrier;
  }

  private async assertCanTag(barrier: Barrier, actor: TrafficActor) {
    if (
      actor.is_super_admin ||
      actor.permissions?.includes('manage_traffic_command')
    ) {
      return;
    }
    const device = await this.handheldDeviceRepository.findOne({
      where: { user_id: actor.id, barrier_id: barrier.id, status: 'ACTIVE' },
    });
    if (!device) {
      throw new ForbiddenException(
        'You are not assigned a handheld device on this barrier',
      );
    }
  }

  private resolveSiteLink(
    barrier: Barrier,
    dto: CreateBarrierTagEventDto,
  ): BarrierSiteLink {
    const candidates = (barrier.site_links ?? []).filter(
      (l) =>
        (!dto.site_type || l.site_type === dto.site_type) &&
        (!dto.site_id || l.site_id === dto.site_id) &&
        (!dto.barrier_role || l.barrier_role === dto.barrier_role),
    );
    if (candidates.length === 1) return candidates[0];
    if (!candidates.length) {
      throw new BadRequestException(
        `Barrier ${barrier.barrier_id_number} is not linked to a matching site/role`,
      );
    }
    throw new BadRequestException(
      `Barrier ${barrier.barrier_id_number} serves several sites/roles — send site_type, site_id and barrier_role`,
    );
  }

  private async resolveTruck(dto: CreateBarrierTagEventDto) {
    const rfid = dto.rfid_tag_number?.trim() || null;
    let truck: Truck | null = null;
    if (rfid) {
      const tag = await this.rfidTagRepository.findOne({
        where: [{ rfid_tag_number: rfid }, { etss_tag_number: rfid }],
      });
      truck = tag?.truck_id
        ? await this.truckRepository.findOne({ where: { id: tag.truck_id } })
        : await this.truckRepository.findOne({
            where: { rfid_tag_number: rfid },
          });
    }
    const plate = (
      dto.truck_plate_number?.trim() ||
      truck?.plate_number ||
      ''
    ).toUpperCase();
    if (!plate) {
      throw new BadRequestException(
        rfid
          ? `No truck is registered to tag ${rfid} — send truck_plate_number`
          : 'truck_plate_number or rfid_tag_number is required',
      );
    }
    if (!truck) {
      truck = await this.truckRepository.findOne({
        where: { plate_number: plate },
      });
    }
    return { plate, truck, rfid };
  }

  private async applyTransition(
    booking: Booking,
    link: BarrierSiteLink,
    at: Date,
    barrier: Barrier,
    actor: TrafficActor,
  ): Promise<string | null> {
    const opts = {
      at,
      performedBy:
        [actor.first_name, actor.last_name].filter(Boolean).join(' ') ||
        undefined,
      notes: `Tagged ${link.barrier_role} at barrier ${barrier.barrier_id_number}.`,
    };
    const ownSite =
      (link.site_type === 'FACILITY' && link.site_id === booking.facility_id) ||
      (link.site_type === 'TRANSIT_PARK' &&
        link.site_id === booking.transit_park_id);

    if (link.barrier_role === 'ENTRY') {
      if (
        link.site_type === 'TERMINAL' &&
        link.site_id === booking.terminal_id &&
        !booking.in_terminal_at
      ) {
        await this.bookingsService.markInTerminal(booking.id, undefined, opts);
        return 'IN_TERMINAL';
      }
      return null;
    }

    if (booking.gtg_pregate_at && !booking.left_pregate_at) {
      if (await this.isPregateSite(link)) {
        await this.bookingsService.markLeftPregate(booking.id, undefined, opts);
        return 'LEFT_PREGATE';
      }
      return null;
    }
    if (ownSite && booking.gtg_facility_at && !booking.left_facility_at) {
      await this.bookingsService.markLeftFacility(booking.id, undefined, opts);
      return 'LEFT_FACILITY';
    }
    return null;
  }

  private async isPregateSite(link: BarrierSiteLink): Promise<boolean> {
    if (link.site_type === 'TRANSIT_PARK') {
      const park = await this.transitParkRepository.findOne({
        where: { id: link.site_id },
      });
      return park?.transit_park_type === 'PREGATE';
    }
    if (link.site_type === 'FACILITY') {
      const facility = await this.facilityRepository.findOne({
        where: { id: link.site_id },
      });
      return facility?.facility_type === 'FACILITY_PREGATE';
    }
    return false;
  }

  private mapTagEvent(event: BarrierTagEvent, barrier?: Barrier | null) {
    return {
      id: event.id,
      barrier: barrier
        ? { id: barrier.id, barrier_id_number: barrier.barrier_id_number }
        : { id: event.barrier_id },
      site_type: event.site_type,
      site_id: event.site_id,
      barrier_role: event.barrier_role,
      truck_id: event.truck_id,
      truck_plate_number: event.truck_plate_number,
      rfid_tag_number: event.rfid_tag_number,
      booking_id: event.booking_id,
      booking_transition: event.booking_transition,
      source: event.source,
      tagged_at: event.tagged_at,
      created_at: event.created_at,
    };
  }
}
