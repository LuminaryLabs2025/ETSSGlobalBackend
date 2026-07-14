import { DataSource } from 'typeorm';
import { parseDatabaseUrl } from '../../config/parse-database-url';
import { resolvePostgresSsl } from '../../config/postgres-ssl';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';
import { TeamMember } from '../entities/team-member.entity';
import { PermissionModule } from '../entities/permission-module.entity';
import { Permission } from '../entities/permission.entity';
import { UserTypePermission } from '../entities/user-type-permission.entity';
import { UserPermission } from '../entities/user-permission.entity';
import { ActivityLog } from '../entities/activity-log.entity';
import { UserType } from '../entities/user-type.entity';
import { NotificationSettings } from '../entities/notification-settings.entity';
import {
  BookingCategory,
  FacilityTimeslot,
  FacilityTimeslotAssignment,
  FacilityType,
  FacilityTypeParkType,
  HandheldDevice,
  InfractionCategory,
  Location,
  ParkType,
  PaymentType,
  RfidTag,
  TepType,
  TepTypeBookingCategory,
  TepTypeTruckType,
  TerminalGate,
  TruckCapacity,
  TruckLength,
  TruckType,
} from '../entities/app-options.entities';
import {
  Facility,
  Terminal,
  TransitPark,
} from '../entities/terminals-parks-facilities.entities';
import {
  Driver,
  DriverFlag,
  Tep,
  TepActivityEvent,
  TepMatchedTruck,
  Truck,
  TruckPenalty,
} from '../entities/operations.entities';
import {
  PenaltyDefinition,
  IssuedFine,
  FineDispute,
  FineDisputeEvent,
} from '../entities/fines.entities';
import {
  DttrTerminalRequest,
  DttrSubmission,
  DttrEditAudit,
} from '../entities/dttr.entities';
import {
  Booking,
  BookingTimelineEntry,
  BookingException,
} from '../entities/bookings.entities';
import {
  UtilityTicket,
  UtilityTicketHistory,
  UtilityAssignedPersonnel,
} from '../entities/utility-tickets.entities';

export const SEED_ENTITIES = [
  User,
  Company,
  TeamMember,
  PermissionModule,
  Permission,
  UserTypePermission,
  UserPermission,
  ActivityLog,
  UserType,
  NotificationSettings,
  TruckType,
  TruckCapacity,
  TruckLength,
  BookingCategory,
  TepType,
  TepTypeBookingCategory,
  TepTypeTruckType,
  ParkType,
  FacilityType,
  FacilityTypeParkType,
  FacilityTimeslot,
  FacilityTimeslotAssignment,
  PaymentType,
  InfractionCategory,
  TerminalGate,
  Location,
  HandheldDevice,
  RfidTag,
  Terminal,
  TransitPark,
  Facility,
  Truck,
  TruckPenalty,
  Driver,
  DriverFlag,
  Tep,
  TepMatchedTruck,
  TepActivityEvent,
  PenaltyDefinition,
  IssuedFine,
  FineDispute,
  FineDisputeEvent,
  DttrTerminalRequest,
  DttrSubmission,
  DttrEditAudit,
  Booking,
  BookingTimelineEntry,
  BookingException,
  UtilityTicket,
  UtilityTicketHistory,
  UtilityAssignedPersonnel,
];

/**
 * TypeORM DataSource used by all seed runners.
 * Uses synchronize: true for bootstrap (align with existing seed behavior).
 */
export function createSeedDataSource(): DataSource {
  const databaseUrl = process.env.DATABASE_URL;
  const parsed = databaseUrl ? parseDatabaseUrl(databaseUrl) : null;

  const ssl = resolvePostgresSsl({
    databaseUrl,
    databaseSslEnv: process.env.DATABASE_SSL,
  });

  return new DataSource({
    type: 'postgres',
    host: parsed?.host ?? process.env.DB_HOST ?? 'localhost',
    port: parsed?.port ?? parseInt(process.env.DB_PORT || '5432', 10),
    username: parsed?.username ?? process.env.DB_USERNAME ?? 'postgres',
    password: parsed?.password ?? process.env.DB_PASSWORD ?? 'postgres',
    database: parsed?.database ?? process.env.DB_NAME ?? 'maritime_etss',
    ssl,
    entities: SEED_ENTITIES,
    synchronize: true,
  });
}
