import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { TeamMember } from '../../database/entities/team-member.entity';
import { Role } from '../../database/entities/role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Company, TeamMember, Role])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
