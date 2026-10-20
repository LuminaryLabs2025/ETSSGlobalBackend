import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { OpsCommandService } from './ops-command.service';
import { SystemStaffGuard } from './system-staff.guard';
import {
  Booking,
  Company,
  Incident,
  OpsCommandOrder,
  RevenueTransaction,
  TeamMember,
  Tep,
  Terminal,
  User,
  UserType,
  UtilityTicket,
} from '../../database/entities';
import { TrafficCommandModule } from '../traffic-command/traffic-command.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Company,
      TeamMember,
      UserType,
      Booking,
      Tep,
      UtilityTicket,
      Incident,
      RevenueTransaction,
      Terminal,
      OpsCommandOrder,
    ]),
    TrafficCommandModule,
    MailModule,
  ],
  controllers: [DashboardController, OverviewController],
  providers: [
    DashboardService,
    OverviewService,
    OpsCommandService,
    SystemStaffGuard,
  ],
})
export class DashboardModule {}
