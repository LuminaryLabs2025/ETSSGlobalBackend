import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { TeamMember } from '../../database/entities/team-member.entity';
import { Role } from '../../database/entities/role.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async getStats(currentUser: any) {
    const baseStats: Record<string, any> = {};

    if (currentUser.is_super_admin) {
      const [totalUsers, totalCompanies, totalTeamMembers, totalRoles] =
        await Promise.all([
          this.userRepository.count(),
          this.companyRepository.count(),
          this.teamMemberRepository.count(),
          this.roleRepository.count(),
        ]);

      baseStats.total_users = totalUsers;
      baseStats.total_companies = totalCompanies;
      baseStats.total_team_members = totalTeamMembers;
      baseStats.total_roles = totalRoles;
    } else if (currentUser.company_id) {
      const [companyUsers, companyTeamMembers] = await Promise.all([
        this.userRepository.count({
          where: { company_id: currentUser.company_id },
        }),
        this.teamMemberRepository.count({
          where: { company_id: currentUser.company_id },
        }),
      ]);

      baseStats.company_users = companyUsers;
      baseStats.company_team_members = companyTeamMembers;
    }

    return {
      ...baseStats,
      timestamp: new Date().toISOString(),
    };
  }
}
