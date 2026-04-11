import { DataSource } from 'typeorm';
import { parseDatabaseUrl } from '../../config/parse-database-url';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';
import { TeamMember } from '../entities/team-member.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { TeamMemberRole } from '../entities/team-member-role.entity';
import { ActivityLog } from '../entities/activity-log.entity';
import { UserType } from '../entities/user-type.entity';

export const SEED_ENTITIES = [
  User,
  Company,
  TeamMember,
  Role,
  Permission,
  RolePermission,
  UserRole,
  TeamMemberRole,
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
