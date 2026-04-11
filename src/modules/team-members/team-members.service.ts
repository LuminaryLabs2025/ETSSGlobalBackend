import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TeamMember } from '../../database/entities/team-member.entity';
import { TeamMemberRole } from '../../database/entities/team-member-role.entity';
import { Role } from '../../database/entities/role.entity';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { EMAIL_QUEUE, JOB_INVITE_EMAIL } from '../queue/queue.constants';
import type { InviteEmailJobData } from '../queue/types/email-jobs.types';

@Injectable()
export class TeamMembersService {
  private readonly logger = new Logger(TeamMembersService.name);

  constructor(
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(TeamMemberRole)
    private readonly teamMemberRoleRepository: Repository<TeamMemberRole>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
  ) {}

  async create(
    createDto: CreateTeamMemberDto,
    createdBy: string,
    companyId: string,
    invitedByEmail?: string,
  ): Promise<TeamMember> {
    if (!companyId) {
      throw new ForbiddenException(
        'You must belong to a company to create team members',
      );
    }

    const existing = await this.teamMemberRepository.findOne({
      where: { email: createDto.email },
    });
    if (existing) {
      throw new ConflictException('Team member with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createDto.password, 12);
    const teamMember = this.teamMemberRepository.create({
      ...createDto,
      password: hashedPassword,
      company_id: companyId,
      created_by: createdBy,
    });

    const saved = await this.teamMemberRepository.save(teamMember);

    const jobPayload: InviteEmailJobData = {
      to: saved.email,
      firstName: saved.first_name,
      lastName: saved.last_name,
      invitedByLabel: invitedByEmail,
    };

    try {
      await this.emailQueue.add(JOB_INVITE_EMAIL, jobPayload, {
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
    } catch (err) {
      this.logger.error(
        `Failed to enqueue invite email for ${saved.email}`,
        err,
      );
    }

    return saved;
  }

  async findAllByCompany(companyId: string): Promise<TeamMember[]> {
    return this.teamMemberRepository.find({
      where: { company_id: companyId },
      relations: ['team_member_roles', 'team_member_roles.role'],
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        is_active: true,
        company_id: true,
        created_by: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async findOne(id: string): Promise<TeamMember> {
    const teamMember = await this.teamMemberRepository.findOne({
      where: { id },
      relations: [
        'company',
        'team_member_roles',
        'team_member_roles.role',
        'team_member_roles.role.role_permissions',
        'team_member_roles.role.role_permissions.permission',
      ],
    });
    if (!teamMember) {
      throw new NotFoundException('Team member not found');
    }
    return teamMember;
  }

  async remove(id: string): Promise<void> {
    const teamMember = await this.findOne(id);
    await this.teamMemberRepository.remove(teamMember);
  }

  async assignRole(
    teamMemberId: string,
    roleId: string,
  ): Promise<TeamMemberRole> {
    await this.findOne(teamMemberId);

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const existing = await this.teamMemberRoleRepository.findOne({
      where: { team_member_id: teamMemberId, role_id: roleId },
    });
    if (existing) {
      throw new ConflictException('Role already assigned to this team member');
    }

    const tmRole = this.teamMemberRoleRepository.create({
      team_member_id: teamMemberId,
      role_id: roleId,
    });

    return this.teamMemberRoleRepository.save(tmRole);
  }

  async removeRole(teamMemberId: string, roleId: string): Promise<void> {
    const tmRole = await this.teamMemberRoleRepository.findOne({
      where: { team_member_id: teamMemberId, role_id: roleId },
    });
    if (!tmRole) {
      throw new NotFoundException('Role assignment not found');
    }
    await this.teamMemberRoleRepository.remove(tmRole);
  }
}
