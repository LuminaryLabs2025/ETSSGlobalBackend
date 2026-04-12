import { DataSource } from 'typeorm';
import { parseDatabaseUrl } from '../../config/parse-database-url';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';
import { TeamMember } from '../entities/team-member.entity';
import { PermissionModule } from '../entities/permission-module.entity';
import { Permission } from '../entities/permission.entity';
import { UserTypePermission } from '../entities/user-type-permission.entity';
import { UserPermission } from '../entities/user-permission.entity';
import { ActivityLog } from '../entities/activity-log.entity';
import { UserType } from '../entities/user-type.entity';

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
];

/**
 * TypeORM DataSource used by all seed runners.
 * Uses synchronize: true for bootstrap (align with existing seed behavior).
 */
export function createSeedDataSource(): DataSource {
  const parsed = process.env.DATABASE_URL
    ? parseDatabaseUrl(process.env.DATABASE_URL)
    : null;

  return new DataSource({
    type: 'postgres',
    host: parsed?.host ?? process.env.DB_HOST ?? 'localhost',
    port: parsed?.port ?? parseInt(process.env.DB_PORT || '5432', 10),
    username: parsed?.username ?? process.env.DB_USERNAME ?? 'postgres',
    password: parsed?.password ?? process.env.DB_PASSWORD ?? 'postgres',
    database: parsed?.database ?? process.env.DB_NAME ?? 'maritime_etss',
    entities: SEED_ENTITIES,
    synchronize: true,
  });
}
