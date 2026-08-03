import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { User } from '../../database/entities/user.entity';
import { UserType } from '../../database/entities/user-type.entity';
import { Company } from '../../database/entities/company.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { UserTypePermission } from '../../database/entities/user-type-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { QueryTeamMembersDto } from './dto/query-team-members.dto';
import {
  AccountType,
  TwoFactorMethod,
  UserStatus,
  UserTypeCategory,
} from '../../common/enums';
import { normalizeEmail } from '../../common/utils/email-normalize';
import { EMAIL_QUEUE, JOB_INVITE_EMAIL } from '../queue/queue.constants';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CompaniesService } from '../companies/companies.service';

type RequestActor = {
  id: string;
  is_super_admin?: boolean;
  company_id?: string | null;
};

@Injectable()
export class TeamMembersService {
  private readonly logger = new Logger(TeamMembersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserType)
    private readonly userTypeRepository: Repository<UserType>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(UserPermission)
    private readonly userPermissionRepository: Repository<UserPermission>,
    @InjectRepository(UserTypePermission)
    private readonly userTypePermissionRepository: Repository<UserTypePermission>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
    private readonly configService: ConfigService,
    private readonly activityLogService: ActivityLogService,
    private readonly companiesService: CompaniesService,
  ) {}

  async create(
    dto: CreateTeamMemberDto,
    actor: RequestActor,
    actorEmail?: string,
  ): Promise<User> {
    const userType = await this.userTypeRepository.findOne({
      where: { id: dto.user_type_id },
    });
    if (!userType) {
      throw new NotFoundException('User type not found');
    }

    let companyId: string | null = null;
    if (userType.category === UserTypeCategory.EXTERNAL) {
      companyId = actor.company_id ?? null;
      if (!companyId) {
        throw new BadRequestException(
          'External user types can only be invited by accounts that belong to a company (your JWT must include company_id). Super admins inviting external members need a company-scoped session.',
        );
      }
    } else {
      // SYSTEM team members belong to the platform company
      const platformCompany =
        await this.companiesService.ensureMaritimeEtssCompany();
      companyId = platformCompany.id;
    }

    this.assertActorCanManageCompany(actor, companyId);

    if (companyId) {
      const company = await this.companyRepository.findOne({
        where: { id: companyId },
      });
      if (!company) throw new NotFoundException('Company not found');
    }

    const emailNorm = normalizeEmail(dto.email);
    const existing = await this.userRepository.findOne({
      where: { email: emailNorm },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const first_name = dto.first_name.trim();
    const last_name = dto.last_name.trim();
    if (!first_name || !last_name) {
      throw new BadRequestException('first_name and last_name are required');
    }
    const hashedPassword = await bcrypt.hash(randomUUID(), 12);
    const inviteToken = randomUUID();
    const inviteTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const joinInviteLink = this.buildJoinInviteLink(emailNorm, inviteToken);
    const localPart = emailNorm.split('@')[0] || 'user';
    const extra: Record<string, unknown> = {
      username: localPart,
      ...(dto.department?.trim()
        ? { department: dto.department.trim() }
        : {}),
    };

    const user = this.userRepository.create({
      first_name,
      last_name,
      email: emailNorm,
      phone: dto.phone?.trim() || null,
      password: hashedPassword,
      user_type_id: userType.id,
      account_type: AccountType.SUB_ACCOUNT,
      status: UserStatus.AWAITING_ACTIVATION,
      company_id: companyId,
      extra_fields: extra,
      invited_by: actor.id,
      is_super_admin: false,
      invite_token: inviteToken,
      invite_token_expires_at: inviteTokenExpiresAt,
      invite_token_used_at: null,
      two_factor_enabled: true,
      two_factor_method: TwoFactorMethod.EMAIL,
    } as Partial<User>);

    const saved = (await this.userRepository.save(user)) as User;

    await this.assignDirectPermissions(
      saved.id,
      userType.id,
      dto.permission_ids,
      !!actor.is_super_admin,
    );

    try {
      await this.emailQueue.add(
        JOB_INVITE_EMAIL,
        {
          to: saved.email,
          firstName: saved.first_name,
          lastName: saved.last_name,
          userType: userType.name,
          invitedByLabel: actorEmail,
          joinInviteLink,
        },
        {
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    } catch (err) {
      this.logger.error(`Failed to enqueue team member invite for ${saved.email}`, err);
    }

    await this.activityLogService.recordEvent({
      userId: actor.id,
      action: 'USER_ONBOARDED',
      module: 'User Management',
      metadata: {
        user_id: saved.id,
        email: saved.email,
        user_type: userType.name,
        account_type: saved.account_type,
      },
    });

    return this.findOne(saved.id, actor);
  }

  async findAll(query: QueryTeamMembersDto, actor: RequestActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.buildScopedQuery(actor)
      .leftJoinAndSelect('user.user_type', 'userType')
      .leftJoinAndSelect('user.company', 'company');

    if (query.user_type_id) {
      qb.andWhere('user.user_type_id = :utid', { utid: query.user_type_id });
    }
    if (query.status) {
      qb.andWhere('user.status = :st', { st: query.status });
    }
    if (query.company_id) {
      if (!actor.company_id || query.company_id !== actor.company_id) {
        throw new ForbiddenException(
          'You can only list team members for your own company',
        );
      }
      qb.andWhere('user.company_id = :fcid', { fcid: query.company_id });
    }
    if (query.date_from) {
      qb.andWhere('user.created_at >= :df', { df: new Date(query.date_from) });
    }
    if (query.date_to) {
      const end = new Date(query.date_to);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('user.created_at <= :dt', { dt: end });
    }
    if (query.search?.trim()) {
      const s = `%${query.search.trim()}%`;
      qb.andWhere(
        '(user.first_name ILIKE :s OR user.last_name ILIKE :s OR user.email ILIKE :s OR CONCAT(user.first_name, \' \', user.last_name) ILIKE :s)',
        { s },
      );
    }

    qb.orderBy('user.created_at', 'DESC');
    const total = await qb.clone().getCount();
    qb.skip((page - 1) * limit).take(limit);
    const rows = await qb.getMany();

    return {
      data: rows.map((u) => this.toListRow(u)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getSummary(actor: RequestActor) {
    const base = this.buildScopedQuery(actor);
    const total = await base.clone().getCount();
    const active = await base
      .clone()
      .andWhere('user.status = :st', { st: UserStatus.ACTIVE })
      .getCount();
    const inactive = await base
      .clone()
      .andWhere('user.status = :st', { st: UserStatus.INACTIVE })
      .getCount();
    const awaiting = await base
      .clone()
      .andWhere('user.status = :st', { st: UserStatus.AWAITING_ACTIVATION })
      .getCount();
    const archived = await base
      .clone()
      .andWhere('user.status = :st', { st: UserStatus.ARCHIVED })
      .getCount();

    const byType = await this.buildScopedQuery(actor)
      .leftJoin('user.user_type', 'ut')
      .select('ut.name', 'user_type')
      .addSelect('COUNT(user.id)', 'count')
      .groupBy('ut.name')
      .getRawMany();

    return {
      total,
      active,
      inactive,
      awaiting_activation: awaiting,
      archived,
      by_user_type: byType.map((r) => ({
        user_type: r.user_type ?? 'Unassigned',
        count: parseInt(r.count, 10),
      })),
    };
  }

  async findOne(id: string, actor: RequestActor): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: [
        'user_type',
        'company',
        'user_permissions',
        'user_permissions.permission',
      ],
    });
    if (!user) throw new NotFoundException('Team member not found');
    this.assertActorCanAccessUser(actor, user);
    return this.sanitizeUser(user);
  }

  async disable(id: string, actor: RequestActor): Promise<User> {
    const user = await this.getManagedUserOrThrow(id, actor);
    user.status = UserStatus.INACTIVE;
    await this.userRepository.save(user);
    return this.findOne(id, actor);
  }

  async enable(id: string, actor: RequestActor): Promise<User> {
    const user = await this.getManagedUserOrThrow(id, actor);
    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);
    return this.findOne(id, actor);
  }

  async archive(id: string, actor: RequestActor): Promise<User> {
    const user = await this.getManagedUserOrThrow(id, actor);
    user.status = UserStatus.ARCHIVED;
    await this.userRepository.save(user);
    return this.findOne(id, actor);
  }

  async resendInvite(id: string, actor: RequestActor): Promise<{ sent: true }> {
    const user = await this.getManagedUserOrThrow(id, actor);
    const inviteToken = randomUUID();
    const inviteTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.status = UserStatus.AWAITING_ACTIVATION;
    user.invite_token = inviteToken;
    user.invite_token_expires_at = inviteTokenExpiresAt;
    user.invite_token_used_at = null;
    await this.userRepository.save(user);

    const joinInviteLink = this.buildJoinInviteLink(user.email, inviteToken);

    try {
      await this.emailQueue.add(
        JOB_INVITE_EMAIL,
        {
          to: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          userType: user.user_type?.name,
          joinInviteLink,
        },
        {
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    } catch (err) {
      this.logger.error(`Failed to enqueue re-invite for ${user.email}`, err);
    }

    return { sent: true };
  }

  // ─── Helpers ───

  private buildScopedQuery(actor: RequestActor) {
    const qb = this.userRepository.createQueryBuilder('user');

    // Always scope to the requester's company (including Super Admin → Maritime ETSS)
    if (!actor.company_id) {
      qb.andWhere('1 = 0');
    } else {
      qb.andWhere('user.company_id = :cid', { cid: actor.company_id });
    }

    return qb;
  }

  private assertActorCanManageCompany(
    actor: RequestActor,
    companyId: string | null,
  ) {
    if (actor.is_super_admin) return;
    if (companyId == null) {
      throw new ForbiddenException(
        'Only Super Admin can create team members without a company',
      );
    }
    if (actor.company_id !== companyId) {
      throw new ForbiddenException(
        'You can only create team members for your own company',
      );
    }
  }

  private assertActorCanAccessUser(actor: RequestActor, user: User) {
    if (!actor.company_id || user.company_id !== actor.company_id) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async getManagedUserOrThrow(
    id: string,
    actor: RequestActor,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['user_type', 'company'],
    });
    if (!user) throw new NotFoundException('Team member not found');
    this.assertActorCanAccessUser(actor, user);
    return user;
  }

  /**
   * Stores explicit grants on the user. Empty `permissionIds` → all permissions
   * allowed for that user type (from `user_type_permissions`). Super admin may
   * assign any permission IDs when `bypassValidation` is true.
   */
  private async assignDirectPermissions(
    userId: string,
    userTypeId: string,
    permissionIds: string[] | undefined,
    bypassValidation: boolean,
  ): Promise<void> {
    const links = await this.userTypePermissionRepository.find({
      where: { user_type_id: userTypeId },
    });
    const allowedIds = new Set(links.map((l) => l.permission_id));

    let chosen: string[];
    if (permissionIds?.length) {
      const unique = [...new Set(permissionIds)];
      if (!bypassValidation) {
        for (const id of unique) {
          if (!allowedIds.has(id)) {
            throw new BadRequestException(
              'One or more permissions are not allowed for this user type',
            );
          }
        }
      }
      chosen = unique;
    } else {
      chosen = [...allowedIds];
    }

    if (chosen.length === 0) return;

    const found = await this.permissionRepository.count({
      where: { id: In(chosen) },
    });
    if (found !== chosen.length) {
      throw new BadRequestException('One or more permission_ids are invalid');
    }

    const rows = chosen.map((permission_id) =>
      this.userPermissionRepository.create({ user_id: userId, permission_id }),
    );
    await this.userPermissionRepository.save(rows);
  }

  private toListRow(user: User) {
    const dept =
      (user.extra_fields?.department as string | undefined) ?? null;
    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone ?? null,
      user_type: user.user_type
        ? { id: user.user_type.id, name: user.user_type.name }
        : null,
      status: user.status,
      account_type: user.account_type,
      company: user.company
        ? { id: user.company.id, name: user.company.name }
        : null,
      department: dept,
      created_at: user.created_at,
    };
  }

  private sanitizeUser(user: User): User {
    const { password, ...rest } = user as any;
    return rest as User;
  }

  private buildJoinInviteLink(email: string, token: string): string {
    const frontendBase = this.configService
      .get<string>('FRONTEND_URL', 'https://etss-global.onrender.com')
      .replace(/\/$/, '');
    const joinPath = this.configService.get<string>(
      'JOIN_INVITE_PATH',
      '/join-invite',
    );
    const path = joinPath.startsWith('/') ? joinPath : `/${joinPath}`;
    const query = new URLSearchParams({ token, email }).toString();
    return `${frontendBase}${path}?${query}`;
  }
}
