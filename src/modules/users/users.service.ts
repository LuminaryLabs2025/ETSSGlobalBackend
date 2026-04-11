import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository, Brackets } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { validate as isUuid } from 'uuid';
import { User } from '../../database/entities/user.entity';
import { UserType } from '../../database/entities/user-type.entity';
import { Company } from '../../database/entities/company.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';
import { ActivityLog } from '../../database/entities/activity-log.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import {
  AccountType,
  UserStatus,
  UserTypeCategory,
} from '../../common/enums';
import { MetadataValidatorService } from '../../common/services/metadata-validator.service';
import { EMAIL_QUEUE, JOB_INVITE_EMAIL } from '../queue/queue.constants';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserType)
    private readonly userTypeRepository: Repository<UserType>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
    private readonly metadataValidator: MetadataValidatorService,
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
  ) {}

  async create(dto: CreateUserDto, createdById?: string): Promise<User> {
    const userType = await this.userTypeRepository.findOne({
      where: { id: dto.user_type_id },
    });
    if (!userType) {
      throw new NotFoundException('User type not found');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const validatedExtra = this.metadataValidator.validate(
      userType.metadata,
      dto.extra_fields || null,
    );

    const rawPassword = dto.password || this.generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const isExternal = userType.category === UserTypeCategory.EXTERNAL;

    let company: Company | null = null;
    if (isExternal) {
      if (!dto.organization_name) {
        throw new BadRequestException(
          'Organization name is required for external user types',
        );
      }
      company = await this.createOrFindCompany(dto, userType, validatedExtra);
    }

    const user = this.userRepository.create({
      first_name: dto.first_name,
      last_name: dto.last_name,
      email: dto.email,
      phone: dto.phone,
      password: hashedPassword,
      user_type_id: userType.id,
      account_type: isExternal ? AccountType.PRIMARY : AccountType.SYSTEM,
      status: UserStatus.AWAITING_ACTIVATION,
      company_id: company?.id ?? null,
      extra_fields: validatedExtra,
      invited_by: createdById ?? null,
      is_super_admin: false,
    } as Partial<User>);

    const saved = await this.userRepository.save(user) as User;

    await this.logActivity(
      createdById || null,
      'CREATE_USER',
      'users',
      saved.id,
      { user_type: userType.name, email: saved.email },
    );

    try {
      await this.emailQueue.add(
        JOB_INVITE_EMAIL,
        {
          to: saved.email,
          firstName: saved.first_name,
          lastName: saved.last_name,
          tempPassword: rawPassword,
          userType: userType.name,
        },
        {
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    } catch (err) {
      this.logger.error(`Failed to enqueue invite for ${saved.email}`, err);
    }

    return this.findOne(saved.id);
  }

  async findAll(query: QueryUsersDto) {
    if (query.user_type_id && !isUuid(query.user_type_id)) {
      throw new BadRequestException('user_type_id must be a valid UUID');
    }
    if (query.company_id && !isUuid(query.company_id)) {
      throw new BadRequestException('company_id must be a valid UUID');
    }

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.user_type', 'userType')
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('user.user_roles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role');

    if (query.user_type_id) {
      qb.andWhere('user.user_type_id = :userTypeId', {
        userTypeId: query.user_type_id,
      });
    }

    if (query.account_type) {
      qb.andWhere('user.account_type = :accountType', {
        accountType: query.account_type,
      });
    }

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    if (query.company_id) {
      qb.andWhere('user.company_id = :companyId', {
        companyId: query.company_id,
      });
    }

    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('user.first_name ILIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('user.last_name ILIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('user.email ILIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('company.name ILIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    if (query.date_from) {
      qb.andWhere('user.created_at >= :dateFrom', {
        dateFrom: query.date_from,
      });
    }

    if (query.date_to) {
      qb.andWhere('user.created_at <= :dateTo', {
        dateTo: query.date_to,
      });
    }

    const allowedSortFields = [
      'created_at',
      'first_name',
      'last_name',
      'email',
      'status',
    ];
    const sortField = allowedSortFields.includes(query.sort_by!)
      ? query.sort_by!
      : 'created_at';
    const sortOrder = query.sort_order === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`user.${sortField}`, sortOrder);

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map((u) => this.sanitizeUser(u)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: [
        'user_type',
        'company',
        'user_roles',
        'user_roles.role',
        'user_roles.role.role_permissions',
        'user_roles.role.role_permissions.permission',
      ],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, {
      ...(dto.first_name && { first_name: dto.first_name }),
      ...(dto.last_name && { last_name: dto.last_name }),
      ...(dto.phone && { phone: dto.phone }),
      ...(dto.extra_fields && {
        extra_fields: { ...user.extra_fields, ...dto.extra_fields },
      }),
    });
    await this.userRepository.save(user);
    return this.findOne(id);
  }

  async disable(id: string, actionBy: string): Promise<User> {
    const user = await this.findOne(id);
    user.status = UserStatus.INACTIVE;
    await this.userRepository.save(user);
    await this.logActivity(actionBy, 'DISABLE_USER', 'users', id);
    return user;
  }

  async enable(id: string, actionBy: string): Promise<User> {
    const user = await this.findOne(id);
    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);
    await this.logActivity(actionBy, 'ENABLE_USER', 'users', id);
    return user;
  }

  async archive(id: string, actionBy: string): Promise<User> {
    const user = await this.findOne(id);
    user.status = UserStatus.ARCHIVED;
    await this.userRepository.save(user);
    await this.logActivity(actionBy, 'ARCHIVE_USER', 'users', id);
    return user;
  }

  async resendInvite(id: string, actionBy: string): Promise<{ sent: true }> {
    const user = await this.findOne(id);

    const newPassword = this.generatePassword();
    user.password = await bcrypt.hash(newPassword, 12);
    user.status = UserStatus.AWAITING_ACTIVATION;
    await this.userRepository.save(user);

    try {
      await this.emailQueue.add(
        JOB_INVITE_EMAIL,
        {
          to: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          tempPassword: newPassword,
          userType: user.user_type?.name,
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

    await this.logActivity(actionBy, 'RESEND_INVITE', 'users', id);
    return { sent: true };
  }

  async getSummary() {
    const total = await this.userRepository.count();
    const active = await this.userRepository.count({
      where: { status: UserStatus.ACTIVE },
    });
    const inactive = await this.userRepository.count({
      where: { status: UserStatus.INACTIVE },
    });
    const awaiting = await this.userRepository.count({
      where: { status: UserStatus.AWAITING_ACTIVATION },
    });
    const archived = await this.userRepository.count({
      where: { status: UserStatus.ARCHIVED },
    });

    const byType = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.user_type', 'ut')
      .select('ut.name', 'user_type')
      .addSelect('ut.category', 'category')
      .addSelect('COUNT(user.id)', 'count')
      .groupBy('ut.name')
      .addGroupBy('ut.category')
      .getRawMany();

    return {
      total,
      active,
      inactive,
      awaiting_activation: awaiting,
      archived,
      by_user_type: byType.map((row) => ({
        user_type: row.user_type || 'Unassigned',
        category: row.category || null,
        count: parseInt(row.count, 10),
      })),
    };
  }

  async exportCsv(query: QueryUsersDto): Promise<string> {
    const allQuery = { ...query, page: 1, limit: 10000 };
    const { data } = await this.findAll(allQuery);

    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'User Type',
      'Account Type',
      'Status',
      'Company',
      'Created At',
    ];

    const rows = data.map((u: any) =>
      [
        this.csvEscape(u.first_name),
        this.csvEscape(u.last_name),
        this.csvEscape(u.email),
        this.csvEscape(u.phone || ''),
        this.csvEscape(u.user_type?.name || ''),
        this.csvEscape(u.account_type),
        this.csvEscape(u.status),
        this.csvEscape(u.company?.name || ''),
        u.created_at,
      ].join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  async assignRole(userId: string, roleId: string): Promise<UserRole> {
    await this.findOne(userId);
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const existing = await this.userRoleRepository.findOne({
      where: { user_id: userId, role_id: roleId },
    });
    if (existing) {
      throw new ConflictException('Role already assigned to this user');
    }

    return this.userRoleRepository.save(
      this.userRoleRepository.create({ user_id: userId, role_id: roleId }),
    );
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: { user_id: userId, role_id: roleId },
    });
    if (!userRole) throw new NotFoundException('Role assignment not found');
    await this.userRoleRepository.remove(userRole);
  }

  // ─── Private helpers ───

  private async createOrFindCompany(
    dto: CreateUserDto,
    userType: UserType,
    validatedExtra: Record<string, any>,
  ): Promise<Company> {
    const existing = await this.companyRepository.findOne({
      where: { name: dto.organization_name!, user_type_id: userType.id },
    });
    if (existing) return existing;

    const company = this.companyRepository.create({
      name: dto.organization_name!,
      address: dto.address || null,
      phone: dto.phone || null,
      email: dto.email,
      user_type_id: userType.id,
      extra_data: validatedExtra,
    } as Partial<Company>);
    return this.companyRepository.save(company) as Promise<Company>;
  }

  private generatePassword(): string {
    return crypto.randomBytes(6).toString('base64url').slice(0, 12);
  }

  private sanitizeUser(user: User) {
    const { password, ...rest } = user as any;
    return rest;
  }

  private csvEscape(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private async logActivity(
    userId: string | null,
    action: string,
    entity: string,
    entityId: string,
    metadata?: Record<string, any>,
  ) {
    try {
      const log = this.activityLogRepository.create({
        user_id: userId,
        action,
        entity,
        entity_id: entityId,
        metadata: metadata || null,
      } as Partial<ActivityLog>);
      await this.activityLogRepository.save(log);
    } catch {
      // never break the request for logging failures
    }
  }
}
