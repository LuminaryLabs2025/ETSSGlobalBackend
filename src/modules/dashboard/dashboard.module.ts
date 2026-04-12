import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { TeamMember } from '../../database/entities/team-member.entity';
import { UserType } from '../../database/entities/user-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Company, TeamMember, UserType]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
