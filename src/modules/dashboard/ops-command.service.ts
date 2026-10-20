import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import {
  Booking,
  Incident,
  OpsCommandOrder,
  User,
} from '../../database/entities';
import { UserStatus } from '../../common/enums';
import {
  nextSequentialCode,
  paginateQueryBuilder,
  requireEntity,
} from '../../common/utils/query-helpers';
import {
  stageSinceSql,
  stageSql,
} from '../traffic-command/traffic-command.constants';
import { INCIDENT_TYPE_LABELS } from '../incidents/incidents.constants';
import { MailService } from '../mail/mail.service';
import { OverviewService } from './overview.service';
import {
  ADVISORY_INCIDENT_SEVERITIES,
  ADVISORY_INCIDENT_TYPES,
  OPS_COMMAND_ACTIONS,
  OPS_COMMAND_ACTION_META,
  OpsCommandAction,
  PRIORITY_WAIT_MINUTES,
} from './dashboard.constants';
import {
  AuthoriseOpsCommandDto,
  LiftOpsCommandDto,
  QueryOpsCommandOrdersDto,
} from './dto/overview.dto';

type Target = { type: string; id: string; name: string };
type Recommendation = {
  recommended: boolean;
  reason: string | null;
  targets: Target[];
};
export type OpsActor = {
  id: string;
  first_name?: string;
  last_name?: string;
};

/** Sites under this utilisation can take overflow trucks. */
const OVERFLOW_SPARE_BELOW = 50;
const OVERFLOW_TARGET_LIMIT = 3;
/** Actions that may run as several concurrent orders (one per convoy). */
const MULTI_ORDER_ACTIONS: OpsCommandAction[] = ['PRIORITY_MOVEMENT'];

/**
 * Operations Command & Control (AI-Powered on the design). Recommendations
 * are rule-based over live congestion, open incidents and priority queues;
 * a SuperAdmin authorises an action, which is logged as an order and sent
 * to LASTMA / Ops Control (OPS_COMMAND_NOTIFY_EMAILS — falls back to the
 * active SuperAdmins until those addresses are configured).
 */
@Injectable()
export class OpsCommandService {
  private readonly logger = new Logger(OpsCommandService.name);

  constructor(
    @InjectRepository(OpsCommandOrder)
    private readonly orderRepository: Repository<OpsCommandOrder>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly overviewService: OverviewService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  /** The five action cards with the current recommendation and any active orders. */
  async board() {
    const [{ congestion, recommendations }, activeOrders, recipients] =
      await Promise.all([
        this.evaluate(),
        this.orderRepository.find({
          where: { status: 'ACTIVE' },
          order: { authorised_at: 'DESC' },
        }),
        this.recipients(),
      ]);
    return {
      congestion: {
        index: congestion.index,
        threshold: congestion.threshold,
        level: congestion.level,
      },
      actions: OPS_COMMAND_ACTIONS.map((action) => ({
        action,
        ...OPS_COMMAND_ACTION_META[action],
        ...recommendations[action],
        active_orders: activeOrders
          .filter((o) => o.action === action)
          .map((o) => this.mapOrder(o)),
      })),
      notification: {
        source: recipients.source,
        recipient_count: recipients.emails.length,
      },
      last_updated: new Date(),
    };
  }

  async authorise(dto: AuthoriseOpsCommandDto, actor: OpsActor) {
    if (!MULTI_ORDER_ACTIONS.includes(dto.action)) {
      const existing = await this.orderRepository.findOne({
        where: { action: dto.action, status: 'ACTIVE' },
      });
      if (existing) {
        throw new ConflictException(
          `${OPS_COMMAND_ACTION_META[dto.action].title} is already active (${existing.reference_id}) — lift it first`,
        );
      }
    }
    const { congestion, recommendations } = await this.evaluate();
    const recommendation = recommendations[dto.action];
    const known = new Map(recommendation.targets.map((t) => [t.id, t]));
    const targets: Target[] = dto.targets
      ? dto.targets.map((t) => ({
          type: t.type,
          id: t.id,
          name: t.name ?? known.get(t.id)?.name ?? '',
        }))
      : recommendation.targets;
    if (
      (dto.action === 'SUSPEND_RED_ZONE_DISPATCH' ||
        dto.action === 'PRIORITY_MOVEMENT') &&
      !targets.length
    ) {
      throw new BadRequestException(
        `${OPS_COMMAND_ACTION_META[dto.action].title} needs at least one target`,
      );
    }

    const now = new Date();
    const actorName = this.fullName(actor);
    const order = await this.withReferenceRetry(async () =>
      this.orderRepository.save(
        this.orderRepository.create({
          reference_id: await nextSequentialCode(
            this.orderRepository,
            'reference_id',
            `OPS-${now.getFullYear()}`,
            6,
          ),
          action: dto.action,
          status: 'ACTIVE',
          targets,
          notes: dto.notes?.trim() || null,
          was_recommended: recommendation.recommended,
          recommendation_reason: recommendation.reason,
          congestion_index: congestion.index,
          authorised_by: actor.id,
          authorised_by_name: actorName,
          authorised_at: now,
        }),
      ),
    );

    await this.notify(order, 'AUTHORISED', actorName, now);
    return this.mapOrder(
      await this.orderRepository.findOneByOrFail({ id: order.id }),
    );
  }

  async lift(id: string, dto: LiftOpsCommandDto, actor: OpsActor) {
    const order = await requireEntity(
      this.orderRepository,
      id,
      'Ops command order not found',
    );
    if (order.status !== 'ACTIVE') {
      throw new BadRequestException('Only ACTIVE orders can be lifted');
    }
    const now = new Date();
    const actorName = this.fullName(actor);
    order.status = 'LIFTED';
    order.lifted_at = now;
    order.lifted_by = actor.id;
    order.lifted_by_name = actorName;
    order.lift_reason = dto.reason?.trim() || null;
    await this.orderRepository.save(order);
    await this.notify(order, 'LIFTED', actorName, now);
    return this.mapOrder(await this.orderRepository.findOneByOrFail({ id }));
  }

  async list(query: QueryOpsCommandOrdersDto) {
    const qb = this.orderRepository.createQueryBuilder('o');
    if (query.status)
      qb.andWhere('o.status = :status', { status: query.status });
    if (query.action)
      qb.andWhere('o.action = :action', { action: query.action });
    qb.orderBy('o.authorised_at', 'DESC');
    const result = await paginateQueryBuilder(qb, query.page, query.limit);
    return {
      data: result.data.map((o) => this.mapOrder(o)),
      meta: result.meta,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Rules
  // ─────────────────────────────────────────────────────────────────────

  private async evaluate() {
    const [congestion, incidents, priorityWaiting] = await Promise.all([
      this.overviewService.congestion(),
      this.incidentRepository
        .createQueryBuilder('i')
        .where('i.status IN (:...open)', {
          open: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'],
        })
        .andWhere('i.type IN (:...types)', { types: ADVISORY_INCIDENT_TYPES })
        .andWhere('i.severity IN (:...severities)', {
          severities: ADVISORY_INCIDENT_SEVERITIES,
        })
        .orderBy('i.reported_at', 'DESC')
        .getMany(),
      this.bookingRepository
        .createQueryBuilder('b')
        .where("b.status = 'LIVE'")
        .andWhere('b.priority_rank = 1')
        .andWhere(`${stageSql('b')} IN ('GTG_FACILITY', 'GTG_PREGATE')`)
        .andWhere(`${stageSinceSql('b')} <= :cutoff`, {
          cutoff: new Date(Date.now() - PRIORITY_WAIT_MINUTES * 60 * 1000),
        })
        .orderBy(stageSinceSql('b'), 'ASC')
        .limit(50)
        .getMany(),
    ]);

    const siteTarget = (s: (typeof congestion.sites)[number]): Target => ({
      type: s.site_type,
      id: s.id,
      name: s.name,
    });
    const pct = (s: (typeof congestion.sites)[number]) =>
      `${s.name} (${s.utilisation_percentage}%)`;
    const redZone = congestion.sites.filter((s) => s.in_red_zone);
    const redParks = redZone.filter((s) => s.site_type !== 'TERMINAL');
    const spare = congestion.sites
      .filter(
        (s) =>
          s.site_type !== 'TERMINAL' &&
          s.utilisation_percentage < OVERFLOW_SPARE_BELOW,
      )
      .sort((a, b) => a.utilisation_percentage - b.utilisation_percentage)
      .slice(0, OVERFLOW_TARGET_LIMIT);
    const corridorRed = congestion.in_red_zone;
    const congestionIncidents = incidents.filter(
      (i) => i.type === 'GATE_CONGESTION',
    );
    const incidentText = (list: Incident[]) =>
      list
        .slice(0, 3)
        .map(
          (i) =>
            `${INCIDENT_TYPE_LABELS[i.type] ?? i.type} at ${i.location_name} (${i.severity})`,
        )
        .join('; ');

    const recommendations: Record<OpsCommandAction, Recommendation> = {
      SUSPEND_RED_ZONE_DISPATCH: {
        recommended: redZone.length > 0,
        reason: redZone.length
          ? `${redZone.length} site(s) at or above ${congestion.threshold}% capacity: ${redZone.slice(0, 5).map(pct).join(', ')}`
          : null,
        targets: redZone.map(siteTarget),
      },
      REROUTE_CORRIDOR_TRAFFIC: {
        recommended: corridorRed || congestionIncidents.length > 0,
        reason: corridorRed
          ? `Corridor congestion index ${congestion.index}/100 is in the red zone`
          : congestionIncidents.length
            ? `Open gate congestion: ${incidentText(congestionIncidents)}`
            : null,
        targets: redZone.map(siteTarget),
      },
      ACTIVATE_OVERFLOW_HOLDING: {
        recommended: redParks.length > 0 && spare.length > 0,
        reason:
          redParks.length && spare.length
            ? `${redParks.slice(0, 3).map(pct).join(', ')} over threshold; spare capacity at ${spare.map(pct).join(', ')}`
            : null,
        targets: spare.map(siteTarget),
      },
      BROADCAST_DIVERSION_ADVISORY: {
        recommended: corridorRed || incidents.length > 0,
        reason: incidents.length
          ? `${incidents.length} open high-severity corridor incident(s): ${incidentText(incidents)}`
          : corridorRed
            ? `Corridor congestion index ${congestion.index}/100 is in the red zone`
            : null,
        targets: [],
      },
      PRIORITY_MOVEMENT: {
        recommended: priorityWaiting.length > 0,
        reason: priorityWaiting.length
          ? `${priorityWaiting.length} priority (Fish / EPT) truck(s) waiting over ${PRIORITY_WAIT_MINUTES} mins at a GTG stage`
          : null,
        targets: priorityWaiting.map((b) => ({
          type: 'BOOKING',
          id: b.id,
          name: `${b.booking_id} · ${b.truck_plate_number}`,
        })),
      },
    };
    return { congestion, recommendations };
  }

  // ─────────────────────────────────────────────────────────────────────

  /** OPS_COMMAND_NOTIFY_EMAILS, or every active SuperAdmin when it is unset. */
  private async recipients(): Promise<{
    source: 'CONFIGURED' | 'SUPER_ADMINS';
    emails: string[];
  }> {
    const configured = (
      this.config.get<string>('OPS_COMMAND_NOTIFY_EMAILS') ?? ''
    )
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    if (configured.length) return { source: 'CONFIGURED', emails: configured };
    const admins = await this.userRepository.find({
      select: { email: true },
      where: { is_super_admin: true, status: UserStatus.ACTIVE },
    });
    return {
      source: 'SUPER_ADMINS',
      emails: [...new Set(admins.map((u) => u.email).filter(Boolean))],
    };
  }

  /** Emails LASTMA / Ops Control; a delivery failure is recorded, not thrown. */
  private async notify(
    order: OpsCommandOrder,
    event: 'AUTHORISED' | 'LIFTED',
    actorName: string,
    at: Date,
  ) {
    const recipients = (await this.recipients()).emails;
    if (!recipients.length) {
      await this.orderRepository.update(order.id, {
        notification_error:
          'No recipients (set OPS_COMMAND_NOTIFY_EMAILS or activate a SuperAdmin)',
      });
      return;
    }
    const failures: string[] = [];
    for (const to of recipients) {
      try {
        await this.mailService.sendOpsCommandOrderEmail(to, {
          referenceId: order.reference_id,
          title:
            OPS_COMMAND_ACTION_META[order.action as OpsCommandAction].title,
          event,
          actorName,
          at,
          targets: order.targets.map((t) => t.name || t.id),
          reason:
            event === 'AUTHORISED'
              ? order.recommendation_reason
              : order.lift_reason,
          notes: event === 'AUTHORISED' ? order.notes : null,
        });
      } catch (error) {
        failures.push(to);
        this.logger.warn(
          `Ops command ${order.reference_id} ${event} email to ${to} failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    await this.orderRepository.update(order.id, {
      notified_recipients: recipients.filter((r) => !failures.includes(r)),
      notified_at: failures.length === recipients.length ? null : at,
      notification_error: failures.length
        ? `Delivery failed to: ${failures.join(', ')}`
        : null,
    });
  }

  private async withReferenceRetry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await work();
      } catch (error) {
        const duplicate =
          error instanceof QueryFailedError &&
          (error as unknown as { constraint?: string }).constraint ===
            'UQ_ops_command_orders_reference_id';
        if (!duplicate || attempt >= 3) throw error;
      }
    }
  }

  private fullName(actor: OpsActor): string {
    return (
      [actor.first_name, actor.last_name].filter(Boolean).join(' ') ||
      'SuperAdmin'
    );
  }

  private mapOrder(o: OpsCommandOrder) {
    return {
      id: o.id,
      reference_id: o.reference_id,
      action: o.action,
      title:
        OPS_COMMAND_ACTION_META[o.action as OpsCommandAction]?.title ??
        o.action,
      status: o.status,
      targets: o.targets,
      notes: o.notes,
      was_recommended: o.was_recommended,
      recommendation_reason: o.recommendation_reason,
      congestion_index: o.congestion_index,
      authorised_by: { id: o.authorised_by, name: o.authorised_by_name },
      authorised_at: o.authorised_at,
      notified_recipients: o.notified_recipients,
      notified_at: o.notified_at,
      notification_error: o.notification_error,
      lifted_at: o.lifted_at,
      lifted_by: o.lifted_by
        ? { id: o.lifted_by, name: o.lifted_by_name }
        : null,
      lift_reason: o.lift_reason,
    };
  }
}
