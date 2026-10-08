import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  In,
  QueryFailedError,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  Booking,
  Company,
  Driver,
  Facility,
  Incident,
  IncidentEvent,
  IncidentEvidence,
  IncidentNote,
  Terminal,
  TransitPark,
  Truck,
  User,
} from '../../database/entities';
import { AccountType, UserStatus } from '../../common/enums';
import {
  nextSequentialCode,
  paginateQueryBuilder,
  toCsv,
} from '../../common/utils/query-helpers';
import { resolveDateRange } from '../../common/utils/date-range';
import {
  EMERGENCY_ACTION_LABELS,
  ESCALATION_LABELS,
  INCIDENT_LOCATION_KIND_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  OPEN_STATUSES,
  RESOLVED_STATUSES,
  STATUS_GROUP_STATUSES,
  SUPER_ADMIN_TEAM,
} from './incidents.constants';
import {
  AddIncidentCommentDto,
  AddIncidentEvidenceDto,
  ApproveIncidentResolutionDto,
  AssignIncidentDto,
  CreateIncidentDto,
  EmergencyResponseDto,
  EscalateIncidentDto,
  IncidentEvidenceItemDto,
  QueryIncidentsDto,
  QueryMyIncidentsDto,
  RejectIncidentResolutionDto,
  ReopenIncidentDto,
  RequestIncidentEvidenceDto,
  ResolveIncidentDto,
  SetIncidentDeadlineDto,
  SubmitIncidentResolutionDto,
  UpdateIncidentSeverityDto,
} from './dto/incidents.dto';

export type IncidentActor = {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_super_admin?: boolean;
  company_id?: string | null;
};

type Access = 'REPORTER' | 'ASSIGNEE';

/** Scalar columns only — relations can't go through Repository.update(). */
type IncidentChanges = Partial<
  Omit<
    Incident,
    | 'reporter'
    | 'reporter_company'
    | 'truck'
    | 'driver'
    | 'booking'
    | 'assigned_company'
    | 'assigned_user'
    | 'evidence'
    | 'events'
    | 'notes'
  >
>;

const LIST_RELATIONS = ['assigned_user'];
const DETAIL_RELATIONS = ['assigned_user', 'evidence', 'events', 'notes'];
const LOCKED_STATUSES = ['RESOLVED', 'CLOSED'];

/**
 * Incident Reports (MVP 090). PRIMARY account holders report incidents for
 * their company; SuperAdmin triages them (assign team/user, severity,
 * deadline, escalation, evidence requests, emergency response) and
 * approves/rejects the resolution the assigned team submits.
 *
 * Lifecycle: OPEN → ASSIGNED → IN_PROGRESS → PENDING_SUPERADMIN_APPROVAL →
 * CLOSED (approved) | REOPENED (rejected). SuperAdmin may also resolve
 * directly (RESOLVED) and reopen RESOLVED/CLOSED incidents.
 */
@Injectable()
export class IncidentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // Reporting (PRIMARY account holders)
  // ─────────────────────────────────────────────────────────────────────

  async create(dto: CreateIncidentDto, actor: IncidentActor) {
    const reporter = await this.requirePrimaryAccount(actor);
    const company = await this.companyRepository.findOne({
      where: { id: reporter.company_id! },
    });

    const isBreakdown = dto.type === 'TRUCK_BREAKDOWN';
    if (
      !isBreakdown &&
      (dto.truck_id ||
        dto.truck_plate_number ||
        dto.driver_id ||
        dto.booking_id)
    ) {
      throw new BadRequestException(
        'Related truck / driver / booking can only be attached to TRUCK_BREAKDOWN incidents',
      );
    }

    return this.withReferenceRetry(async (manager) => {
      const location = await this.resolveLocation(manager, dto);
      const related = isBreakdown
        ? await this.resolveRelated(manager, dto)
        : null;
      const incident = manager.getRepository(Incident).create({
        reference_id: await this.nextReference(manager),
        type: dto.type,
        description: dto.description.trim(),
        severity: dto.severity ?? 'MEDIUM',
        status: 'OPEN',
        location_kind: dto.location_kind,
        location_id: location.id,
        location_name: location.name,
        reported_by: reporter.id,
        reporter_name: this.fullName(reporter),
        reporter_email: reporter.email,
        reporter_company_id: reporter.company_id,
        reporter_company_name: company?.name ?? null,
        reported_at: new Date(),
        payment_reference: dto.payment_reference?.trim() || null,
        ...related,
      });
      const saved = await manager.getRepository(Incident).save(incident);
      await this.saveEvidence(manager, saved.id, dto.evidence, 'REPORT', actor);
      await this.addEvent(manager, saved.id, actor, {
        event_type: 'REPORTED',
        title: 'Incident reported',
        detail: `${INCIDENT_TYPE_LABELS[saved.type]} at ${saved.location_name}`,
      });
      return saved.id;
    }).then((id) => this.findDetail(id));
  }

  async findMine(query: QueryMyIncidentsDto, actor: IncidentActor) {
    const user = await this.loadUser(actor.id);
    const qb = this.listQuery(query);
    if ((query.scope ?? 'REPORTED') === 'REPORTED') {
      this.assertPrimary(user);
      qb.andWhere('i.reporter_company_id = :companyId', {
        companyId: user.company_id,
      });
    } else {
      qb.andWhere(
        new Brackets((w) => {
          w.where('i.assigned_user_id = :userId', { userId: user.id });
          if (user.company_id) {
            w.orWhere('i.assigned_company_id = :companyId', {
              companyId: user.company_id,
            });
          }
        }),
      );
    }
    return this.paginate(qb, query);
  }

  async findMineOne(id: string, actor: IncidentActor) {
    const incident = await this.requireIncident(id);
    await this.resolveAccess(incident, actor);
    return this.findDetail(id);
  }

  async addEvidenceAsAccount(
    id: string,
    dto: AddIncidentEvidenceDto,
    actor: IncidentActor,
  ) {
    const incident = await this.requireIncident(id);
    const access = await this.resolveAccess(incident, actor);
    this.assertNotLocked(incident);
    await this.dataSource.transaction(async (manager) => {
      await this.saveEvidence(manager, id, dto.evidence, 'REPORT', actor);
      const wasRequested = Boolean(incident.evidence_requested_at);
      if (wasRequested && access === 'REPORTER') {
        await manager
          .getRepository(Incident)
          .update({ id }, { evidence_requested_at: null });
      }
      await this.addEvent(manager, id, actor, {
        event_type: 'EVIDENCE_ADDED',
        title: wasRequested ? 'Requested evidence provided' : 'Evidence added',
        detail: dto.evidence.map((e) => e.label).join(', '),
      });
    });
    return this.findDetail(id);
  }

  async commentAsAccount(
    id: string,
    dto: AddIncidentCommentDto,
    actor: IncidentActor,
  ) {
    const incident = await this.requireIncident(id);
    await this.resolveAccess(incident, actor);
    const user = await this.loadUser(actor.id);
    const company = user.company_id
      ? await this.companyRepository.findOne({ where: { id: user.company_id } })
      : null;
    await this.addNote(id, actor, 'COMMENT', dto.body, company?.name ?? null);
    return this.findDetail(id);
  }

  /** Assigned team/user: ASSIGNED / REOPENED → IN_PROGRESS. */
  async startWork(id: string, actor: IncidentActor) {
    const incident = await this.requireIncident(id);
    await this.assertAccess(incident, actor, 'ASSIGNEE');
    this.assertStatus(incident, [
      'ASSIGNED',
      'REOPENED',
      'REJECTED_BY_SUPERADMIN',
    ]);
    await this.transition(
      incident,
      actor,
      { status: 'IN_PROGRESS' },
      {
        event_type: 'IN_PROGRESS',
        title: 'Work started on incident',
        is_action: true,
      },
    );
    return this.findDetail(id);
  }

  /** Assigned team/user submits root cause / corrective action for SuperAdmin approval. */
  async submitResolution(
    id: string,
    dto: SubmitIncidentResolutionDto,
    actor: IncidentActor,
  ) {
    const incident = await this.requireIncident(id);
    await this.assertAccess(incident, actor, 'ASSIGNEE');
    this.assertStatus(incident, [
      'ASSIGNED',
      'IN_PROGRESS',
      'REOPENED',
      'REJECTED_BY_SUPERADMIN',
    ]);
    await this.dataSource.transaction(async (manager) => {
      await this.saveEvidence(manager, id, dto.evidence, 'RESOLUTION', actor);
      await this.transition(
        incident,
        actor,
        {
          status: 'PENDING_SUPERADMIN_APPROVAL',
          root_cause: dto.root_cause ?? null,
          corrective_action: dto.corrective_action ?? null,
          resolution_notes: dto.resolution_notes,
          resolution_submitted_at: new Date(),
        },
        {
          event_type: 'RESOLUTION_SUBMITTED',
          title: 'Resolution submitted for SuperAdmin approval',
          detail: dto.resolution_notes,
          is_action: true,
        },
        manager,
      );
    });
    return this.findDetail(id);
  }

  // ─────────────────────────────────────────────────────────────────────
  // SuperAdmin
  // ─────────────────────────────────────────────────────────────────────

  async summary(query: QueryIncidentsDto) {
    const qb = this.incidentRepository.createQueryBuilder('i');
    this.applyDateRange(qb, query);
    const rows = await qb
      .select('i.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('i.status')
      .getRawMany<{ status: string; count: string }>();
    const byStatus = new Map(rows.map((r) => [r.status, Number(r.count)]));
    const sum = (statuses: string[]) =>
      statuses.reduce((acc, s) => acc + (byStatus.get(s) ?? 0), 0);

    const openQb = this.incidentRepository
      .createQueryBuilder('i')
      .where('i.status IN (:...open)', { open: OPEN_STATUSES });
    this.applyDateRange(openQb, query);
    const [severity, overdue] = await Promise.all([
      openQb
        .clone()
        .select('i.severity', 'severity')
        .addSelect('COUNT(*)', 'count')
        .groupBy('i.severity')
        .getRawMany<{ severity: string; count: string }>(),
      openQb
        .clone()
        .andWhere('i.priority_deadline < :now', { now: new Date() })
        .getCount(),
    ]);

    return {
      open: sum(OPEN_STATUSES),
      pending_approval: sum(['PENDING_SUPERADMIN_APPROVAL']),
      resolved: sum(RESOLVED_STATUSES),
      total: rows.reduce((acc, r) => acc + Number(r.count), 0),
      overdue,
      by_status: Object.keys(INCIDENT_STATUS_LABELS).map((status) => ({
        status,
        label: INCIDENT_STATUS_LABELS[status],
        count: byStatus.get(status) ?? 0,
      })),
      open_by_severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => ({
        severity: s,
        count: Number(severity.find((r) => r.severity === s)?.count ?? 0),
      })),
    };
  }

  async findAll(query: QueryIncidentsDto) {
    return this.paginate(this.listQuery(query), query);
  }

  async exportCsv(query: QueryIncidentsDto) {
    const rows = await this.listQuery(query).take(10_000).getMany();
    return toCsv([
      [
        'S/No.',
        'Incident Reference ID',
        'Incident Type',
        'Incident Description',
        'Severity Level',
        'Location',
        'Time Reported',
        'Status',
        'Assigned Team',
        'Assigned User',
        'Reported By',
        'Reporter Company',
      ],
      ...rows.map((i, n) => [
        n + 1,
        i.reference_id,
        INCIDENT_TYPE_LABELS[i.type],
        i.description,
        i.severity,
        i.location_name,
        i.reported_at.toISOString(),
        INCIDENT_STATUS_LABELS[i.status],
        i.assigned_team_name,
        i.assigned_user ? this.fullName(i.assigned_user) : '',
        i.reporter_name,
        i.reporter_company_name,
      ]),
    ]);
  }

  async findDetail(id: string) {
    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: DETAIL_RELATIONS,
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return this.mapDetail(incident);
  }

  async assign(id: string, dto: AssignIncidentDto, actor: IncidentActor) {
    if (!dto.assigned_company_id && !dto.assigned_user_id) {
      throw new BadRequestException(
        'assigned_company_id or assigned_user_id is required',
      );
    }
    const incident = await this.requireIncident(id);
    this.assertNotLocked(incident);

    let user: User | null = null;
    if (dto.assigned_user_id) {
      user = await this.userRepository.findOne({
        where: { id: dto.assigned_user_id },
      });
      if (!user) throw new NotFoundException('Assigned user not found');
    }
    const companyId = dto.assigned_company_id ?? user?.company_id ?? null;
    if (
      user &&
      dto.assigned_company_id &&
      user.company_id !== dto.assigned_company_id
    ) {
      throw new BadRequestException(
        'Assigned user does not belong to the assigned company',
      );
    }
    const company = companyId
      ? await this.companyRepository.findOne({ where: { id: companyId } })
      : null;
    if (companyId && !company) {
      throw new NotFoundException('Assigned company not found');
    }

    const team = company?.name ?? SUPER_ADMIN_TEAM;
    const who = [team, user ? this.fullName(user) : null]
      .filter(Boolean)
      .join(' / ');
    const reassigned = Boolean(
      incident.assigned_company_id || incident.assigned_user_id,
    );
    await this.transition(
      incident,
      actor,
      {
        assigned_company_id: company?.id ?? null,
        assigned_team_name: team,
        assigned_user_id: user?.id ?? null,
        assigned_at: new Date(),
        status:
          incident.status === 'PENDING_SUPERADMIN_APPROVAL'
            ? incident.status
            : 'ASSIGNED',
      },
      {
        event_type: reassigned ? 'REASSIGNED' : 'ASSIGNED',
        title: `${reassigned ? 'Reassigned' : 'Assigned'} to ${who}`,
        detail: dto.note,
        is_action: true,
      },
    );
    return this.findDetail(id);
  }

  async updateSeverity(
    id: string,
    dto: UpdateIncidentSeverityDto,
    actor: IncidentActor,
  ) {
    const incident = await this.requireIncident(id);
    this.assertNotLocked(incident);
    if (incident.severity === dto.severity) {
      throw new BadRequestException(`Severity is already ${dto.severity}`);
    }
    await this.transition(
      incident,
      actor,
      { severity: dto.severity },
      {
        event_type: 'SEVERITY_CHANGED',
        title: `Severity changed from ${incident.severity} to ${dto.severity}`,
        detail: dto.reason,
        is_action: true,
      },
    );
    return this.findDetail(id);
  }

  async setDeadline(
    id: string,
    dto: SetIncidentDeadlineDto,
    actor: IncidentActor,
  ) {
    const incident = await this.requireIncident(id);
    this.assertNotLocked(incident);
    const deadline = new Date(dto.priority_deadline);
    if (deadline.getTime() <= Date.now()) {
      throw new BadRequestException('Priority deadline must be in the future');
    }
    await this.transition(
      incident,
      actor,
      { priority_deadline: deadline },
      {
        event_type: 'DEADLINE_SET',
        title: `Priority deadline set to ${deadline.toISOString()}`,
        is_action: true,
      },
    );
    return this.findDetail(id);
  }

  async commentAsAdmin(
    id: string,
    dto: AddIncidentCommentDto,
    actor: IncidentActor,
  ) {
    await this.requireIncident(id);
    const kind = dto.kind ?? 'COMMENT';
    await this.dataSource.transaction(async (manager) => {
      await this.addNote(id, actor, kind, dto.body, SUPER_ADMIN_TEAM, manager);
      if (kind === 'INSTRUCTION') {
        await this.addEvent(manager, id, actor, {
          event_type: 'INSTRUCTION_ADDED',
          title: 'SuperAdmin instruction added',
          detail: dto.body,
          is_action: true,
        });
      }
    });
    return this.findDetail(id);
  }

  async escalate(id: string, dto: EscalateIncidentDto, actor: IncidentActor) {
    const incident = await this.requireIncident(id);
    this.assertNotLocked(incident);
    await this.transition(
      incident,
      actor,
      { escalation_level: dto.level, escalated_at: new Date() },
      {
        event_type: 'ESCALATED',
        title: `Escalated to ${ESCALATION_LABELS[dto.level]}`,
        detail: dto.notes,
        is_action: true,
      },
    );
    return this.findDetail(id);
  }

  async requestEvidence(
    id: string,
    dto: RequestIncidentEvidenceDto,
    actor: IncidentActor,
  ) {
    const incident = await this.requireIncident(id);
    this.assertNotLocked(incident);
    await this.dataSource.transaction(async (manager) => {
      await this.transition(
        incident,
        actor,
        { evidence_requested_at: new Date() },
        {
          event_type: 'EVIDENCE_REQUESTED',
          title: 'More evidence requested from reporter',
          detail: dto.message,
          is_action: true,
        },
        manager,
      );
      await this.addNote(
        id,
        actor,
        'INSTRUCTION',
        dto.message,
        SUPER_ADMIN_TEAM,
        manager,
      );
    });
    return this.findDetail(id);
  }

  async triggerEmergency(
    id: string,
    dto: EmergencyResponseDto,
    actor: IncidentActor,
  ) {
    const incident = await this.requireIncident(id);
    this.assertNotLocked(incident);
    await this.transition(
      incident,
      actor,
      { emergency_action: dto.action, emergency_triggered_at: new Date() },
      {
        event_type: 'EMERGENCY_RESPONSE',
        title: `Emergency response triggered: ${EMERGENCY_ACTION_LABELS[dto.action]}`,
        detail: dto.notes,
        is_action: true,
      },
    );
    return this.findDetail(id);
  }

  async approveResolution(
    id: string,
    dto: ApproveIncidentResolutionDto,
    actor: IncidentActor,
  ) {
    const incident = await this.requireIncident(id);
    this.assertStatus(incident, ['PENDING_SUPERADMIN_APPROVAL']);
    const now = new Date();
    await this.transition(
      incident,
      actor,
      {
        status: 'CLOSED',
        resolved_at: incident.resolution_submitted_at ?? now,
        resolved_by: actor.id,
        closed_at: now,
        sla_met: this.slaMet(incident, incident.resolution_submitted_at ?? now),
      },
      {
        event_type: 'RESOLUTION_APPROVED',
        title: 'Resolution approved — incident closed',
        detail: dto.notes,
        is_action: true,
      },
    );
    return this.findDetail(id);
  }

  async rejectResolution(
    id: string,
    dto: RejectIncidentResolutionDto,
    actor: IncidentActor,
  ) {
    const incident = await this.requireIncident(id);
    this.assertStatus(incident, ['PENDING_SUPERADMIN_APPROVAL']);
    await this.dataSource.transaction(async (manager) => {
      await this.transition(
        incident,
        actor,
        { status: 'REOPENED', resolution_submitted_at: null },
        {
          event_type: 'RESOLUTION_REJECTED',
          title: 'Resolution rejected — incident reopened',
          detail: dto.reason,
          is_action: true,
        },
        manager,
      );
      await this.addNote(
        id,
        actor,
        'REJECTION',
        dto.reason,
        SUPER_ADMIN_TEAM,
        manager,
      );
    });
    return this.findDetail(id);
  }

  /** SuperAdmin closes the loop without an assignee submission. */
  async resolve(id: string, dto: ResolveIncidentDto, actor: IncidentActor) {
    const incident = await this.requireIncident(id);
    this.assertNotLocked(incident);
    const now = new Date();
    await this.transition(
      incident,
      actor,
      {
        status: 'RESOLVED',
        root_cause: dto.root_cause ?? incident.root_cause,
        corrective_action: dto.corrective_action ?? incident.corrective_action,
        resolution_notes: dto.resolution_notes,
        resolved_at: now,
        resolved_by: actor.id,
        sla_met: this.slaMet(incident, now),
      },
      {
        event_type: 'RESOLVED',
        title: 'Incident resolved by SuperAdmin',
        detail: dto.resolution_notes,
        is_action: true,
      },
    );
    return this.findDetail(id);
  }

  async reopen(id: string, dto: ReopenIncidentDto, actor: IncidentActor) {
    const incident = await this.requireIncident(id);
    this.assertStatus(incident, RESOLVED_STATUSES);
    await this.transition(
      incident,
      actor,
      {
        status: 'REOPENED',
        resolved_at: null,
        resolved_by: null,
        closed_at: null,
        sla_met: null,
        resolution_submitted_at: null,
      },
      {
        event_type: 'REOPENED',
        title: 'Incident reopened',
        detail: dto.reason,
        is_action: true,
      },
    );
    return this.findDetail(id);
  }

  async assigneeCompanies(search?: string) {
    const qb = this.companyRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user_type', 'ut')
      .where('c.is_active = true');
    if (search?.trim()) {
      qb.andWhere('c.name ILIKE :search', { search: `%${search.trim()}%` });
    }
    const companies = await qb.orderBy('c.name', 'ASC').take(50).getMany();
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      user_type: c.user_type?.name ?? null,
    }));
  }

  async assigneeUsers(companyId: string) {
    const users = await this.userRepository.find({
      where: {
        company_id: companyId,
        status: In([UserStatus.ACTIVE, UserStatus.AWAITING_ACTIVATION]),
      },
      order: { first_name: 'ASC' },
    });
    return users.map((u) => ({
      id: u.id,
      name: this.fullName(u),
      email: u.email,
      account_type: u.account_type,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────

  private listQuery(query: QueryIncidentsDto): SelectQueryBuilder<Incident> {
    const qb = this.incidentRepository
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.assigned_user', 'assigned_user');
    if (query.type) qb.andWhere('i.type = :type', { type: query.type });
    if (query.severity) {
      qb.andWhere('i.severity = :severity', { severity: query.severity });
    }
    if (query.status)
      qb.andWhere('i.status = :status', { status: query.status });
    if (query.status_group) {
      qb.andWhere('i.status IN (:...groupStatuses)', {
        groupStatuses: STATUS_GROUP_STATUSES[query.status_group],
      });
    }
    if (query.location_kind) {
      qb.andWhere('i.location_kind = :locationKind', {
        locationKind: query.location_kind,
      });
    }
    if (query.assigned_company_id) {
      qb.andWhere('i.assigned_company_id = :assignedCompanyId', {
        assignedCompanyId: query.assigned_company_id,
      });
    }
    this.applyDateRange(qb, query);
    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        new Brackets((w) => {
          [
            'reference_id',
            'truck_plate_number',
            'location_name',
            'reporter_company_name',
            'booking_reference',
          ].forEach((col) =>
            w.orWhere(`i.${col} ILIKE :search`, { search: `%${search}%` }),
          );
        }),
      );
    }
    return qb.orderBy('i.reported_at', 'DESC');
  }

  private applyDateRange(
    qb: SelectQueryBuilder<Incident>,
    query: QueryIncidentsDto,
  ) {
    const range = resolveDateRange(query);
    if (range.from) qb.andWhere('i.reported_at >= :from', { from: range.from });
    if (range.to) qb.andWhere('i.reported_at <= :to', { to: range.to });
  }

  private async paginate(
    qb: SelectQueryBuilder<Incident>,
    query: QueryIncidentsDto,
  ) {
    const result = await paginateQueryBuilder(qb, query.page, query.limit);
    return {
      data: result.data.map((i) => this.mapListItem(i)),
      meta: result.meta,
    };
  }

  private async requireIncident(id: string): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: LIST_RELATIONS,
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  private async loadUser(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new ForbiddenException('User not found');
    return user;
  }

  private assertPrimary(user: User) {
    if (user.account_type !== AccountType.PRIMARY || !user.company_id) {
      throw new ForbiddenException(
        'Only PRIMARY account holders can report or view their company’s incidents',
      );
    }
  }

  private async requirePrimaryAccount(actor: IncidentActor): Promise<User> {
    const user = await this.loadUser(actor.id);
    this.assertPrimary(user);
    return user;
  }

  /** Reporter side = PRIMARY user of the reporting company; assignee side = assigned user or a user of the assigned company. */
  private async resolveAccess(
    incident: Incident,
    actor: IncidentActor,
  ): Promise<Access> {
    const user = await this.loadUser(actor.id);
    if (
      incident.assigned_user_id === user.id ||
      (user.company_id && incident.assigned_company_id === user.company_id)
    ) {
      return 'ASSIGNEE';
    }
    if (
      user.account_type === AccountType.PRIMARY &&
      user.company_id &&
      incident.reporter_company_id === user.company_id
    ) {
      return 'REPORTER';
    }
    throw new ForbiddenException('You do not have access to this incident');
  }

  private async assertAccess(
    incident: Incident,
    actor: IncidentActor,
    required: Access,
  ) {
    const access = await this.resolveAccess(incident, actor);
    if (access !== required) {
      throw new ForbiddenException(
        required === 'ASSIGNEE'
          ? 'Only the assigned team can do this'
          : 'Only the reporting company can do this',
      );
    }
  }

  private assertNotLocked(incident: Incident) {
    if (LOCKED_STATUSES.includes(incident.status)) {
      throw new BadRequestException(
        `Incident is ${INCIDENT_STATUS_LABELS[incident.status].toLowerCase()} — reopen it first`,
      );
    }
  }

  private assertStatus(incident: Incident, allowed: string[]) {
    if (!allowed.includes(incident.status)) {
      throw new BadRequestException(
        `Not allowed while the incident is ${INCIDENT_STATUS_LABELS[incident.status]}`,
      );
    }
  }

  private slaMet(incident: Incident, resolvedAt: Date): boolean | null {
    return incident.priority_deadline
      ? resolvedAt.getTime() <= incident.priority_deadline.getTime()
      : null;
  }

  private async transition(
    incident: Incident,
    actor: IncidentActor,
    changes: IncidentChanges,
    event: {
      event_type: string;
      title: string;
      detail?: string | null;
      is_action?: boolean;
    },
    manager?: EntityManager,
  ) {
    const run = async (m: EntityManager) => {
      await m.getRepository(Incident).update({ id: incident.id }, changes);
      await this.addEvent(m, incident.id, actor, event);
    };
    if (manager) await run(manager);
    else await this.dataSource.transaction(run);
  }

  private async addEvent(
    manager: EntityManager,
    incidentId: string,
    actor: IncidentActor,
    event: {
      event_type: string;
      title: string;
      detail?: string | null;
      is_action?: boolean;
    },
  ) {
    const repo = manager.getRepository(IncidentEvent);
    await repo.save(
      repo.create({
        incident_id: incidentId,
        event_type: event.event_type,
        title: event.title,
        detail: event.detail ?? null,
        is_action: event.is_action ?? false,
        actor_user_id: actor.id,
        actor_name: actor.is_super_admin
          ? `SuperAdmin (${this.fullName(actor)})`
          : this.fullName(actor),
      }),
    );
  }

  private async addNote(
    incidentId: string,
    actor: IncidentActor,
    kind: string,
    body: string,
    team: string | null,
    manager?: EntityManager,
  ) {
    const repo = (manager ?? this.dataSource.manager).getRepository(
      IncidentNote,
    );
    await repo.save(
      repo.create({
        incident_id: incidentId,
        kind,
        body: body.trim(),
        author_user_id: actor.id,
        author_name: this.fullName(actor),
        team,
      }),
    );
  }

  private async saveEvidence(
    manager: EntityManager,
    incidentId: string,
    items: IncidentEvidenceItemDto[] | undefined,
    phase: 'REPORT' | 'RESOLUTION',
    actor: IncidentActor,
  ) {
    if (!items?.length) return;
    const repo = manager.getRepository(IncidentEvidence);
    await repo.save(
      items.map((item) =>
        repo.create({
          incident_id: incidentId,
          label: item.label.trim(),
          type: item.type ?? 'FILE',
          url: item.url,
          phase,
          uploaded_by: actor.id,
          uploaded_by_name: this.fullName(actor),
        }),
      ),
    );
  }

  private async resolveLocation(
    manager: EntityManager,
    dto: CreateIncidentDto,
  ): Promise<{ id: string | null; name: string }> {
    if (!dto.location_id) {
      if (!dto.location_name?.trim()) {
        throw new BadRequestException(
          'location_id or location_name is required',
        );
      }
      return { id: null, name: dto.location_name.trim() };
    }
    const entity =
      dto.location_kind === 'FACILITY'
        ? Facility
        : dto.location_kind === 'TRANSIT_PARK'
          ? TransitPark
          : Terminal;
    const row = await manager
      .getRepository<{ id: string; name: string }>(entity)
      .findOne({ where: { id: dto.location_id } });
    if (!row) {
      throw new NotFoundException(
        `${INCIDENT_LOCATION_KIND_LABELS[dto.location_kind]} not found`,
      );
    }
    return { id: row.id, name: row.name };
  }

  private async resolveRelated(manager: EntityManager, dto: CreateIncidentDto) {
    let truck: Truck | null = null;
    if (dto.truck_id) {
      truck = await manager
        .getRepository(Truck)
        .findOne({ where: { id: dto.truck_id } });
      if (!truck) throw new NotFoundException('Truck not found');
    } else if (dto.truck_plate_number?.trim()) {
      truck = await manager.getRepository(Truck).findOne({
        where: { plate_number: dto.truck_plate_number.trim().toUpperCase() },
      });
    }
    let driver: Driver | null = null;
    if (dto.driver_id) {
      driver = await manager
        .getRepository(Driver)
        .findOne({ where: { id: dto.driver_id } });
      if (!driver) throw new NotFoundException('Driver not found');
    }
    let booking: Booking | null = null;
    if (dto.booking_id) {
      booking = await manager
        .getRepository(Booking)
        .findOne({ where: { id: dto.booking_id } });
      if (!booking) throw new NotFoundException('Booking not found');
    }
    return {
      truck_id: truck?.id ?? booking?.truck_id ?? null,
      truck_plate_number:
        truck?.plate_number ??
        booking?.truck_plate_number ??
        (dto.truck_plate_number?.trim().toUpperCase() || null),
      driver_ref_id: driver?.id ?? booking?.driver_ref_id ?? null,
      driver_name: driver
        ? `${driver.first_name} ${driver.last_name}`.trim()
        : (booking?.driver_name ?? null),
      booking_id: booking?.id ?? null,
      booking_reference: booking?.booking_id ?? null,
    };
  }

  /** Reference ids come from MAX()+1; retry on the (rare) concurrent collision. */
  private async withReferenceRetry<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.dataSource.transaction(work);
      } catch (error) {
        const duplicate =
          error instanceof QueryFailedError &&
          (error as unknown as { code?: string; constraint?: string })
            .constraint === 'UQ_incidents_reference_id';
        if (!duplicate || attempt >= 3) throw error;
      }
    }
  }

  private nextReference(manager: EntityManager) {
    return nextSequentialCode(
      manager.getRepository(Incident),
      'reference_id',
      `INC-${new Date().getFullYear()}`,
      6,
    );
  }

  private fullName(user: { first_name?: string; last_name?: string }): string {
    return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  }

  private mapListItem(i: Incident) {
    const isOpen = OPEN_STATUSES.includes(i.status);
    return {
      id: i.id,
      reference_id: i.reference_id,
      type: i.type,
      type_label: INCIDENT_TYPE_LABELS[i.type],
      description: i.description,
      severity: i.severity,
      status: i.status,
      status_label: INCIDENT_STATUS_LABELS[i.status],
      location: {
        kind: i.location_kind,
        kind_label: INCIDENT_LOCATION_KIND_LABELS[i.location_kind],
        id: i.location_id,
        name: i.location_name,
      },
      reported_at: i.reported_at,
      reporter: {
        id: i.reported_by,
        name: i.reporter_name,
        email: i.reporter_email,
        company_id: i.reporter_company_id,
        company: i.reporter_company_name,
        is_primary_account_user: true,
      },
      assigned_team: i.assigned_team_name,
      assigned_company_id: i.assigned_company_id,
      assigned_user: i.assigned_user
        ? {
            id: i.assigned_user.id,
            name: this.fullName(i.assigned_user),
            email: i.assigned_user.email,
          }
        : null,
      assigned_at: i.assigned_at,
      priority_deadline: i.priority_deadline,
      overdue: Boolean(
        isOpen &&
        i.priority_deadline &&
        i.priority_deadline.getTime() < Date.now(),
      ),
      escalation_level: i.escalation_level,
      evidence_requested: Boolean(i.evidence_requested_at),
      emergency_action: i.emergency_action,
      created_at: i.created_at,
      updated_at: i.updated_at,
    };
  }

  private mapDetail(i: Incident) {
    const events = [...(i.events ?? [])].sort(
      (a, b) => a.created_at.getTime() - b.created_at.getTime(),
    );
    const evidence = [...(i.evidence ?? [])].sort(
      (a, b) => a.created_at.getTime() - b.created_at.getTime(),
    );
    const mapEvidence = (e: IncidentEvidence) => ({
      id: e.id,
      label: e.label,
      type: e.type,
      url: e.url,
      phase: e.phase,
      uploaded_by: e.uploaded_by_name,
      created_at: e.created_at,
    });
    return {
      ...this.mapListItem(i),
      related:
        i.truck_plate_number || i.driver_name || i.booking_reference
          ? {
              truck_id: i.truck_id,
              truck_plate: i.truck_plate_number,
              driver_id: i.driver_ref_id,
              driver_name: i.driver_name,
              booking_uuid: i.booking_id,
              booking_id: i.booking_reference,
            }
          : null,
      payment_reference: i.payment_reference,
      escalated_at: i.escalated_at,
      evidence_requested_at: i.evidence_requested_at,
      emergency_triggered_at: i.emergency_triggered_at,
      evidence: evidence.filter((e) => e.phase === 'REPORT').map(mapEvidence),
      timeline: events.map((e) => ({
        id: e.id,
        event_type: e.event_type,
        title: e.title,
        detail: e.detail,
        actor: e.actor_name,
        timestamp: e.created_at,
      })),
      notes: [...(i.notes ?? [])]
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
        .map((n) => ({
          id: n.id,
          kind: n.kind,
          author: n.author_name,
          team: n.team,
          body: n.body,
          timestamp: n.created_at,
        })),
      actions_taken: events.filter((e) => e.is_action).map((e) => e.title),
      resolution:
        i.resolution_notes || i.resolved_at
          ? {
              root_cause: i.root_cause,
              corrective_action: i.corrective_action,
              resolution_notes: i.resolution_notes,
              submitted_at: i.resolution_submitted_at,
              resolved_at: i.resolved_at,
              closed_at: i.closed_at,
              sla_met: i.sla_met,
              post_resolution_evidence: evidence
                .filter((e) => e.phase === 'RESOLUTION')
                .map(mapEvidence),
            }
          : null,
    };
  }
}
