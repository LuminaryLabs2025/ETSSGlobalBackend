import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  Booking,
  Incident,
  RevenueTransaction,
  Terminal,
  Tep,
  UtilityTicket,
} from '../../database/entities';
import { resolveDateRange } from '../../common/utils/date-range';
import { LiveTrucksService } from '../traffic-command/live-trucks.service';
import { LiveLocationsService } from '../traffic-command/live-locations.service';
import {
  LiveTruckStage,
  PARK_TYPE_LABELS,
  LOCATION_KIND_LABELS,
  stageSql,
} from '../traffic-command/traffic-command.constants';
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  OPEN_STATUSES,
} from '../incidents/incidents.constants';
import { PAYMENT_SOURCE_LABELS } from '../e-revenue/e-revenue.constants';
import {
  DEFAULT_RED_ZONE_THRESHOLD,
  LIFECYCLE_GROUPS,
  STAGE_FEED_LABELS,
  TREND_WINDOW_DAYS,
} from './dashboard.constants';
import {
  OverviewLimitDto,
  OverviewPeriodDto,
  QueryRecentActivityDto,
} from './dto/overview.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const STAGE = stageSql('b');

const money = (value: string | number | null | undefined) =>
  Math.round(Number(value ?? 0) * 100) / 100;

/** Truck joined to a booking by id, falling back to its plate. */
const BOOKING_TRUCK_JOIN =
  't.id = b.truck_id OR (b.truck_id IS NULL AND t.plate_number = b.truck_plate_number)';

/** Bookings with recorded exceptions or a FLAGGED truck (same rule as GET /bookings/summary). */
const FLAGGED_SQL = `(
  EXISTS (SELECT 1 FROM booking_exceptions be WHERE be.booking_id = b.id)
  OR EXISTS (
    SELECT 1 FROM trucks ft
    WHERE ft.plate_number = b.truck_plate_number
      AND ft.registration_status = 'FLAGGED'
  )
)`;

const SEVERITY_RANK_SQL = `(CASE i.severity
  WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END)`;

export type Trend = {
  value: number;
  previous: number;
  /** Absolute % change vs the previous window; null when the previous window was 0. */
  trend_percentage: number | null;
  trend_direction: 'UP' | 'DOWN' | 'FLAT';
  /** Lets the UI colour the arrow — a falling TAT is good news. */
  higher_is_better: boolean;
};

export type CongestionSite = {
  site_type: 'FACILITY' | 'TRANSIT_PARK' | 'TERMINAL';
  id: string;
  name: string;
  code: string;
  kind: string;
  kind_label: string;
  park_type_label: string;
  capacity: number;
  occupied: number;
  utilisation_percentage: number;
  in_red_zone: boolean;
};

export type Congestion = {
  index: number;
  threshold: number;
  level: 'NORMAL' | 'ELEVATED' | 'RED_ZONE';
  in_red_zone: boolean;
  total_capacity: number;
  total_occupied: number;
  red_zone_site_count: number;
  sites: CongestionSite[];
};

/**
 * Dashboard overview (/dashboard home). Corridor-wide figures for
 * SuperAdmin and system staff, built from bookings, trucks, drivers, TEPs,
 * the e-Revenue ledger, incidents and the Traffic Command occupancy model.
 */
@Injectable()
export class OverviewService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Tep)
    private readonly tepRepository: Repository<Tep>,
    @InjectRepository(UtilityTicket)
    private readonly utilityTicketRepository: Repository<UtilityTicket>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(RevenueTransaction)
    private readonly revenueRepository: Repository<RevenueTransaction>,
    @InjectRepository(Terminal)
    private readonly terminalRepository: Repository<Terminal>,
    private readonly liveTrucksService: LiveTrucksService,
    private readonly liveLocationsService: LiveLocationsService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // Corridor status banner + Red-Zone
  // ─────────────────────────────────────────────────────────────────────

  async corridor() {
    const [trucks, sites, congestion, verified] = await Promise.all([
      this.liveTrucksService.summary({}),
      this.liveLocationsService.loadSites(),
      this.congestion(),
      this.dataSource.query<{ trucks: string; drivers: string }[]>(
        `SELECT
           (SELECT COUNT(DISTINCT t.id) FROM bookings b
              JOIN trucks t ON ${BOOKING_TRUCK_JOIN}
             WHERE b.status = 'LIVE' AND t.registration_status = 'MSS_VERIFIED') AS trucks,
           (SELECT COUNT(DISTINCT d.id) FROM bookings b
              JOIN drivers d ON d.id = b.driver_ref_id
             WHERE b.status = 'LIVE' AND d.verification_status = 'VERIFIED') AS drivers`,
      ),
    ]);
    const active = sites.filter((s) => s.status === 'ACTIVE');
    const count = (type: string) =>
      active.filter((s) => s.site_type === type).length;
    return {
      live_movements: trucks.on_trip,
      live_bookings: trucks.total_bookings,
      active_sites: {
        total: active.length,
        terminals: count('TERMINAL'),
        facilities: count('FACILITY'),
        transit_parks: count('TRANSIT_PARK'),
      },
      verified_trucks_on_corridor: Number(verified[0]?.trucks ?? 0),
      verified_drivers_on_corridor: Number(verified[0]?.drivers ?? 0),
      congestion: {
        index: congestion.index,
        threshold: congestion.threshold,
        level: congestion.level,
        in_red_zone: congestion.in_red_zone,
        red_zone_site_count: congestion.red_zone_site_count,
      },
      last_updated: new Date(),
    };
  }

  /** Red-Zone drill-down: every site with capacity, most congested first. */
  async redZone() {
    const congestion = await this.congestion();
    return { ...congestion, last_updated: new Date() };
  }

  /**
   * Congestion index (0–100) = trucks currently on site ÷ holding capacity
   * across ACTIVE facilities, transit parks and terminals. Facility / park
   * capacity is approved_truck_capacity; a terminal's holding capacity is
   * approved_trucks_per_hour × hourly_truck_tat_minutes ÷ 60 (trucks inside
   * at once at the approved rate), skipped when either is unset. A site, or
   * the corridor, is in the red zone at ≥ the threshold.
   */
  async congestion(): Promise<Congestion> {
    const threshold = this.redZoneThreshold();
    const [sites, occupancy, terminals] = await Promise.all([
      this.liveLocationsService.loadSites(),
      this.liveLocationsService.occupancy(new Date(Date.now() - DAY_MS)),
      this.terminalRepository.find({ where: { archived_at: IsNull() } }),
    ]);
    const terminalHolding = new Map(
      terminals.map((t) => [
        t.id,
        t.approved_trucks_per_hour && t.hourly_truck_tat_minutes
          ? Math.round(
              (Number(t.approved_trucks_per_hour) *
                Number(t.hourly_truck_tat_minutes)) /
                60,
            )
          : 0,
      ]),
    );

    const rows: CongestionSite[] = [];
    for (const site of sites) {
      if (site.status !== 'ACTIVE') continue;
      const capacity =
        site.site_type === 'TERMINAL'
          ? (terminalHolding.get(site.id) ?? 0)
          : Number(site.capacity ?? 0);
      if (capacity <= 0) continue;
      const occupied = occupancy.get(`${site.site_type}:${site.id}`) ?? 0;
      const utilisation = Math.round((occupied / capacity) * 1000) / 10;
      rows.push({
        site_type: site.site_type,
        id: site.id,
        name: site.name,
        code: site.code,
        kind: site.kind,
        kind_label: LOCATION_KIND_LABELS[site.kind],
        park_type_label: PARK_TYPE_LABELS[site.park_type] ?? site.park_type,
        capacity,
        occupied,
        utilisation_percentage: utilisation,
        in_red_zone: utilisation >= threshold,
      });
    }
    rows.sort((a, b) => b.utilisation_percentage - a.utilisation_percentage);

    const totalCapacity = rows.reduce((acc, r) => acc + r.capacity, 0);
    const totalOccupied = rows.reduce((acc, r) => acc + r.occupied, 0);
    const index = totalCapacity
      ? Math.min(100, Math.round((totalOccupied / totalCapacity) * 100))
      : 0;
    return {
      index,
      threshold,
      level:
        index >= threshold
          ? 'RED_ZONE'
          : index >= threshold * 0.7
            ? 'ELEVATED'
            : 'NORMAL',
      in_red_zone: index >= threshold,
      total_capacity: totalCapacity,
      total_occupied: totalOccupied,
      red_zone_site_count: rows.filter((r) => r.in_red_zone).length,
      sites: rows,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Executive Intelligence Dashboard
  // ─────────────────────────────────────────────────────────────────────

  /** Six KPI tiles; trends compare the last 7 days with the 7 before. */
  async executive() {
    const now = new Date();
    const windowStart = new Date(now.getTime() - TREND_WINDOW_DAYS * DAY_MS);
    const prevStart = new Date(now.getTime() - 2 * TREND_WINDOW_DAYS * DAY_MS);

    const [counts, tat] = await Promise.all([
      this.dataSource.query<Record<string, string>[]>(
        `SELECT
           (SELECT COUNT(*) FROM bookings b WHERE b.status = 'LIVE') AS live_bookings,
           (SELECT COUNT(*) FROM bookings b WHERE b.created_at >= $1) AS bookings_now,
           (SELECT COUNT(*) FROM bookings b WHERE b.created_at >= $2 AND b.created_at < $1) AS bookings_prev,
           (SELECT COUNT(*) FROM trucks WHERE registration_status = 'MSS_VERIFIED') AS verified_trucks,
           (SELECT COUNT(*) FROM trucks WHERE registration_status = 'MSS_VERIFIED'
              AND COALESCE(verification_timestamp, created_at) < $1) AS verified_trucks_prev,
           (SELECT COUNT(*) FROM drivers WHERE verification_status = 'VERIFIED') AS verified_drivers,
           (SELECT COUNT(*) FROM drivers WHERE verification_status = 'VERIFIED'
              AND COALESCE(verification_timestamp, created_at) < $1) AS verified_drivers_prev,
           (SELECT COUNT(*) FROM bookings b WHERE b.status = 'LIVE' AND ${FLAGGED_SQL}) AS exceptions,
           (SELECT COUNT(*) FROM booking_exceptions WHERE created_at >= $1) AS exceptions_now,
           (SELECT COUNT(*) FROM booking_exceptions WHERE created_at >= $2 AND created_at < $1) AS exceptions_prev`,
        [windowStart, prevStart],
      ),
      this.dataSource.query<
        { location: string; bucket: string; minutes: string }[]
      >(
        `SELECT t.location,
                CASE WHEN b.in_terminal_at >= $1 THEN 'now' ELSE 'prev' END AS bucket,
                AVG(EXTRACT(EPOCH FROM (b.in_terminal_at - b.created_at)) / 60) AS minutes
           FROM bookings b
           JOIN terminals t ON t.id = b.terminal_id
          WHERE b.in_terminal_at >= $2
            AND b.in_terminal_at > b.created_at
          GROUP BY t.location, bucket`,
        [windowStart, prevStart],
      ),
    ]);
    const c = counts[0] ?? {};
    const n = (key: string) => Number(c[key] ?? 0);
    const tatMinutes = (location: string, bucket: string) => {
      const row = tat.find(
        (r) => r.location === location && r.bucket === bucket,
      );
      return row ? Number(row.minutes) : null;
    };
    const tatTile = (location: string) => {
      const current = tatMinutes(location, 'now');
      const previous = tatMinutes(location, 'prev');
      const hours = (m: number | null) =>
        m === null ? 0 : Math.round((m / 60) * 10) / 10;
      return {
        ...this.trend(hours(current), hours(previous), false),
        unit: 'HOURS',
        display: current === null ? null : `${hours(current)}h`,
        minutes: current === null ? null : Math.round(current),
      };
    };

    return {
      window_days: TREND_WINDOW_DAYS,
      live_bookings: {
        // Tile shows bookings currently LIVE; the trend is bookings created per window.
        ...this.trend(n('bookings_now'), n('bookings_prev'), true),
        value: n('live_bookings'),
      },
      verified_trucks: this.trend(
        n('verified_trucks'),
        n('verified_trucks_prev'),
        true,
      ),
      verified_drivers: this.trend(
        n('verified_drivers'),
        n('verified_drivers_prev'),
        true,
      ),
      avg_tat_apapa: tatTile('APAPA'),
      avg_tat_tincan: tatTile('TINCAN'),
      exceptions: {
        // Tile shows LIVE flagged bookings; the trend is exceptions raised per window.
        ...this.trend(n('exceptions_now'), n('exceptions_prev'), false),
        value: n('exceptions'),
      },
      last_updated: now,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // e-Revenue breakdown + header pill
  // ─────────────────────────────────────────────────────────────────────

  /**
   * All-time successful revenue per source (from the e-Revenue ledger) with
   * a 7-day trend. Only bookings raise payments today, so the other cards
   * read 0 until their flows exist.
   */
  async revenue() {
    const now = new Date();
    const windowStart = new Date(now.getTime() - TREND_WINDOW_DAYS * DAY_MS);
    const prevStart = new Date(now.getTime() - 2 * TREND_WINDOW_DAYS * DAY_MS);
    const rows = await this.revenueRepository
      .createQueryBuilder('r')
      .select('r.payment_source', 'source')
      .addSelect('COALESCE(SUM(r.amount_paid), 0)', 'total')
      .addSelect(
        'COALESCE(SUM(r.amount_paid) FILTER (WHERE r.transacted_at >= :windowStart), 0)',
        'now',
      )
      .addSelect(
        'COALESCE(SUM(r.amount_paid) FILTER (WHERE r.transacted_at >= :prevStart AND r.transacted_at < :windowStart), 0)',
        'prev',
      )
      .where("r.status = 'SUCCESSFUL'")
      .setParameters({ windowStart, prevStart })
      .groupBy('r.payment_source')
      .getRawMany<{
        source: string;
        total: string;
        now: string;
        prev: string;
      }>();
    const bySource = new Map(rows.map((r) => [r.source, r]));

    const cards = (
      ['BOOKING', 'PENALTY', 'UTILITY_TICKET', 'TOW_TRUCK_REQUEST'] as const
    ).map((source) => {
      const row = bySource.get(source);
      const trend = this.trend(money(row?.now), money(row?.prev), true);
      return {
        source,
        label: `From ${PAYMENT_SOURCE_LABELS[source]}`,
        amount: money(row?.total),
        last_7_days: trend.value,
        previous_7_days: trend.previous,
        trend_percentage: trend.trend_percentage,
        trend_direction: trend.trend_direction,
      };
    });
    return {
      currency: 'NGN',
      // Header pill — every source, including any not carded (e.g. demurrage).
      total_amount: money(rows.reduce((acc, r) => acc + Number(r.total), 0)),
      cards,
      last_updated: now,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Booking → Manifest lifecycle
  // ─────────────────────────────────────────────────────────────────────

  async lifecycle() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [trucks, extra] = await Promise.all([
      this.liveTrucksService.summary({}),
      this.dataSource.query<{ available: string; left_terminal: string }[]>(
        `SELECT
           (SELECT COUNT(*) FROM trucks t
             WHERE t.registration_status = 'MSS_VERIFIED'
               AND (t.truck_status IS NULL OR t.truck_status IN ('AVAILABLE', 'LEFT_TERMINAL'))
               AND NOT EXISTS (
                 SELECT 1 FROM bookings b
                  WHERE b.status = 'LIVE' AND (${BOOKING_TRUCK_JOIN})
               )) AS available,
           (SELECT COUNT(*) FROM bookings WHERE left_terminal_at >= $1) AS left_terminal`,
        [startOfDay],
      ),
    ]);
    const stageCounts = new Map(trucks.by_stage.map((s) => [s.stage, s.count]));
    const counts = {
      AVAILABLE: Number(extra[0]?.available ?? 0),
      LEFT_TERMINAL: Number(extra[0]?.left_terminal ?? 0),
    };
    return {
      total_live: trucks.total_bookings,
      groups: LIFECYCLE_GROUPS.map((group) => ({
        key: group.key,
        label: group.label,
        items: group.items.map((item) => ({
          key: item.key,
          label: item.label,
          description: item.description,
          count: item.stages
            ? item.stages.reduce(
                (acc, stage) => acc + (stageCounts.get(stage) ?? 0),
                0,
              )
            : (counts[item.key as keyof typeof counts] ?? 0),
        })),
      })),
      last_updated: new Date(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Charts
  // ─────────────────────────────────────────────────────────────────────

  /** Live / Completed / Cancelled / Expired bookings per destination terminal. */
  async bookingsByTerminal(query: OverviewPeriodDto) {
    const range = resolveDateRange(query);
    const qb = this.bookingRepository
      .createQueryBuilder('b')
      .leftJoin('b.terminal', 't')
      .select('t.id', 'terminal_id')
      .addSelect(
        "COALESCE(t.name, NULLIF(b.terminal_destination, ''), 'Unassigned')",
        'terminal',
      )
      .addSelect("COUNT(*) FILTER (WHERE b.status = 'LIVE')", 'live')
      .addSelect("COUNT(*) FILTER (WHERE b.status = 'COMPLETED')", 'completed')
      .addSelect("COUNT(*) FILTER (WHERE b.status = 'CANCELLED')", 'cancelled')
      .addSelect("COUNT(*) FILTER (WHERE b.status = 'EXPIRED')", 'expired')
      .addSelect('COUNT(*)', 'total');
    if (range.from) qb.andWhere('b.created_at >= :from', { from: range.from });
    if (range.to) qb.andWhere('b.created_at <= :to', { to: range.to });
    const rows = await qb
      .groupBy('t.id')
      .addGroupBy('terminal')
      .orderBy('total', 'DESC')
      .getRawMany<Record<string, string>>();
    return {
      period: this.period(range),
      data: rows.map((r) => ({
        terminal_id: r.terminal_id ?? null,
        terminal: r.terminal,
        live: Number(r.live),
        completed: Number(r.completed),
        cancelled: Number(r.cancelled),
        expired: Number(r.expired),
        total: Number(r.total),
      })),
    };
  }

  /** Truck Entry Permits (TEPs) per facility, split matched / unmatched. */
  async matchingsByFacility(query: OverviewPeriodDto) {
    const range = resolveDateRange(query);
    const qb = this.tepRepository
      .createQueryBuilder('tep')
      .select(
        "COALESCE(NULLIF(tep.facility_name, ''), 'Unassigned')",
        'facility',
      )
      .addSelect('COUNT(*)', 'truck_entry_permits')
      .addSelect(
        "COUNT(*) FILTER (WHERE tep.match_status = 'MATCHED')",
        'matched',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE tep.match_status = 'UNMATCHED')",
        'unmatched',
      );
    if (range.from) {
      qb.andWhere('tep.created_at >= :from', { from: range.from });
    }
    if (range.to) qb.andWhere('tep.created_at <= :to', { to: range.to });
    const rows = await qb
      .groupBy('facility')
      .orderBy('truck_entry_permits', 'DESC')
      .getRawMany<Record<string, string>>();
    return {
      period: this.period(range),
      data: rows.map((r) => ({
        facility: r.facility,
        truck_entry_permits: Number(r.truck_entry_permits),
        matched: Number(r.matched),
        unmatched: Number(r.unmatched),
      })),
    };
  }

  /** Donut: bookings per booking category ("transfer types" on the design). */
  async bookingsByCategory(query: OverviewPeriodDto) {
    const range = resolveDateRange(query);
    const qb = this.bookingRepository
      .createQueryBuilder('b')
      .leftJoin('b.booking_category_ref', 'bc')
      .select('bc.id', 'category_id')
      .addSelect(
        "COALESCE(bc.name, INITCAP(NULLIF(b.booking_category, '')), 'Uncategorised')",
        'category_name',
      )
      .addSelect('COUNT(*)', 'count');
    if (range.from) qb.andWhere('b.created_at >= :from', { from: range.from });
    if (range.to) qb.andWhere('b.created_at <= :to', { to: range.to });
    const rows = await qb
      .groupBy('bc.id')
      .addGroupBy('category_name')
      .orderBy('count', 'DESC')
      .getRawMany<{
        category_id: string | null;
        category_name: string;
        count: string;
      }>();
    const total = rows.reduce((acc, r) => acc + Number(r.count), 0);
    return {
      period: this.period(range),
      total,
      data: rows.map((r) => ({
        category_id: r.category_id ?? null,
        name: r.category_name,
        count: Number(r.count),
        percentage: total
          ? Math.round((Number(r.count) / total) * 1000) / 10
          : 0,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Recent Bookings / Recent Matchings
  // ─────────────────────────────────────────────────────────────────────

  async recentActivity(query: QueryRecentActivityDto) {
    const limit = query.limit ?? 5;
    return query.type === 'matchings'
      ? { type: 'matchings', data: await this.recentMatchings(limit) }
      : { type: 'bookings', data: await this.recentBookings(limit) };
  }

  /** Latest truck bookings and utility tickets, newest first. */
  private async recentBookings(limit: number) {
    const [bookings, tickets] = await Promise.all([
      this.bookingRepository
        .createQueryBuilder('b')
        .addSelect(STAGE, 'stage')
        .orderBy('b.created_at', 'DESC')
        .limit(limit)
        .getRawAndEntities(),
      this.utilityTicketRepository.find({
        order: { date_raised: 'DESC' },
        take: limit,
      }),
    ]);
    const items = [
      ...bookings.entities.map((b, i) => {
        const raw = bookings.raw[i] as { stage?: LiveTruckStage } | undefined;
        const stage = raw?.stage;
        return {
          kind: 'BOOKING' as const,
          id: b.id,
          reference: b.booking_id,
          title: 'Truck Booking',
          plate_number: b.truck_plate_number,
          party: b.transporter_company || b.truck_booked_by,
          destination: b.terminal_destination || null,
          status: b.status === 'LIVE' && stage ? stage : b.status,
          status_label:
            b.status === 'LIVE' && stage
              ? STAGE_FEED_LABELS[stage]
              : this.titleCase(b.status),
          occurred_at: b.created_at,
        };
      }),
      ...tickets.map((t) => ({
        kind: 'UTILITY_TICKET' as const,
        id: t.id,
        reference: t.ticket_id,
        title: 'Utility Ticket',
        plate_number: t.truck_plate_number,
        party: t.terminal_name,
        destination: t.terminal_name,
        status: t.status,
        status_label: this.titleCase(t.status),
        occurred_at: t.date_raised,
      })),
    ];
    return items
      .sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
      )
      .slice(0, limit);
  }

  /** Latest trucks matched to a TEP at their facility. */
  private async recentMatchings(limit: number) {
    const rows = await this.bookingRepository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.facility', 'f')
      .leftJoinAndSelect('b.transit_park', 'tp')
      .leftJoinAndSelect('b.booking_category_ref', 'bc')
      .where('b.matched_at IS NOT NULL')
      .orderBy('b.matched_at', 'DESC')
      .take(limit)
      .getMany();
    return rows.map((b) => ({
      id: b.id,
      booking_id: b.booking_id,
      facility: b.facility?.name ?? b.transit_park?.name ?? null,
      plate_number: b.truck_plate_number,
      category:
        b.booking_category_ref?.name ??
        (b.booking_category ? this.titleCase(b.booking_category) : null),
      destination: b.terminal_destination || null,
      booked_by: b.transporter_company || b.truck_booked_by,
      matched_at: b.matched_at,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────
  // Incident notification board
  // ─────────────────────────────────────────────────────────────────────

  /** Open incidents, most severe then newest first, plus the tow-truck banner count. */
  async incidentBoard(query: OverviewLimitDto) {
    const limit = query.limit ?? 5;
    const [incidents, openTotal, tow] = await Promise.all([
      this.incidentRepository
        .createQueryBuilder('i')
        .addSelect(SEVERITY_RANK_SQL, 'severity_rank')
        .where('i.status IN (:...open)', { open: OPEN_STATUSES })
        .orderBy('severity_rank', 'ASC')
        .addOrderBy('i.reported_at', 'DESC')
        .limit(limit)
        .getMany(),
      this.incidentRepository
        .createQueryBuilder('i')
        .where('i.status IN (:...open)', { open: OPEN_STATUSES })
        .getCount(),
      this.bookingRepository
        .createQueryBuilder('b')
        .where("b.manifest_status = 'LEFT_MANIFEST'")
        .andWhere('b.tow_requested_at IS NOT NULL')
        .andWhere("COALESCE(b.tow_status, 'PENDING') <> 'COMPLETED'")
        .getCount(),
    ]);
    return {
      open_total: openTotal,
      data: incidents.map((i) => {
        const typeLabel = INCIDENT_TYPE_LABELS[i.type] ?? i.type;
        return {
          id: i.id,
          reference_id: i.reference_id,
          title: `${typeLabel} · ${i.location_name}`,
          type: i.type,
          type_label: typeLabel,
          location_name: i.location_name,
          severity: i.severity,
          severity_label: this.titleCase(i.severity),
          status: i.status,
          status_label:
            i.status === 'OPEN'
              ? 'New'
              : (INCIDENT_STATUS_LABELS[i.status] ?? i.status),
          reported_at: i.reported_at,
          reported_by: i.reporter_company_name ?? i.reporter_name ?? null,
        };
      }),
      tow_requests: { pending_left_manifest: tow },
    };
  }

  // ─────────────────────────────────────────────────────────────────────

  redZoneThreshold(): number {
    const raw = Number(this.config.get('CONGESTION_RED_ZONE_THRESHOLD'));
    return Number.isFinite(raw) && raw > 0 && raw <= 100
      ? raw
      : DEFAULT_RED_ZONE_THRESHOLD;
  }

  private trend(
    value: number,
    previous: number,
    higherIsBetter: boolean,
  ): Trend {
    const pct = previous
      ? Math.round((Math.abs(value - previous) / previous) * 1000) / 10
      : null;
    return {
      value,
      previous,
      trend_percentage: pct,
      trend_direction:
        value > previous ? 'UP' : value < previous ? 'DOWN' : 'FLAT',
      higher_is_better: higherIsBetter,
    };
  }

  private period(range: { from?: Date; to?: Date }) {
    return { from: range.from ?? null, to: range.to ?? null };
  }

  private titleCase(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
