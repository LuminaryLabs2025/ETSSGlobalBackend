import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { TeamMember } from '../../database/entities/team-member.entity';
import { UserType } from '../../database/entities/user-type.entity';
import { AccountType } from '../../common/enums';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(UserType)
    private readonly userTypeRepository: Repository<UserType>,
  ) {}

  async getStats(currentUser: any) {
    const baseStats: Record<string, any> = {};

    if (currentUser.is_super_admin) {
      const [
        totalUsers,
        totalCompanies,
        totalTeamMembers,
        totalUserTypes,
        totalSubAccounts,
      ] = await Promise.all([
        this.userRepository.count(),
        this.companyRepository.count(),
        this.teamMemberRepository.count(),
        this.userTypeRepository.count(),
        this.userRepository.count({
          where: { account_type: AccountType.SUB_ACCOUNT },
        }),
      ]);

      baseStats.total_users = totalUsers;
      baseStats.total_companies = totalCompanies;
      baseStats.total_team_members = totalTeamMembers;
      baseStats.total_user_types = totalUserTypes;
      baseStats.total_sub_accounts = totalSubAccounts;
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
