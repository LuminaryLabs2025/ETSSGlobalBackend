import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { getDatabaseConfig } from './config/database.config';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ActivityLogInterceptor } from './common/interceptors/activity-log.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { UserTypesModule } from './modules/user-types/user-types.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { TeamMembersModule } from './modules/team-members/team-members.module';
import { RolesPermissionsModule } from './modules/roles-permissions/roles-permissions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { QueueModule } from './modules/queue/queue.module';
import { ProfileModule } from './modules/profile/profile.module';
import { AppOptionsModule } from './modules/app-options/app-options.module';
import { TerminalsParksFacilitiesModule } from './modules/terminals-parks-facilities/terminals-parks-facilities.module';
import { OperationsModule } from './modules/operations/operations.module';
import { FinesModule } from './modules/fines/fines.module';
import { DttrModule } from './modules/dttr/dttr.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { UtilityTicketsModule } from './modules/utility-tickets/utility-tickets.module';
import { KeepAliveModule } from './modules/keep-alive/keep-alive.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    QueueModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    UserTypesModule,
    CompaniesModule,
    TeamMembersModule,
    RolesPermissionsModule,
    DashboardModule,
    ActivityLogModule,
    ProfileModule,
    AppOptionsModule,
    TerminalsParksFacilitiesModule,
    OperationsModule,
    FinesModule,
    DttrModule,
    BookingsModule,
    UtilityTicketsModule,
    KeepAliveModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],
})
export class AppModule {}
