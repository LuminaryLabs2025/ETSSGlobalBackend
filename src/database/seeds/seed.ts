import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { Company } from '../entities/company.entity';
import { TeamMember } from '../entities/team-member.entity';
import { TeamMemberRole } from '../entities/team-member-role.entity';
import { ActivityLog } from '../entities/activity-log.entity';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'maritime_etss',
  entities: [
    User,
    Company,
    TeamMember,
    Role,
    Permission,
    RolePermission,
    UserRole,
    TeamMemberRole,
    ActivityLog,
  ],
  synchronize: true,
});

const PERMISSIONS = [
  { name: 'create_user', description: 'Create new users' },
  { name: 'manage_users', description: 'View and manage users' },
  { name: 'manage_roles', description: 'Create and manage roles' },
  { name: 'view_dashboard', description: 'View dashboard statistics' },
  { name: 'manage_companies', description: 'Create and manage companies' },
];

const ROLES = [
  { name: 'Super Admin', description: 'Full platform access' },
  { name: 'Admin', description: 'Company-level administrative access' },
  { name: 'Staff', description: 'Basic staff access' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  'Super Admin': [
    'create_user',
    'manage_users',
    'manage_roles',
    'view_dashboard',
    'manage_companies',
  ],
  Admin: ['create_user', 'manage_users', 'view_dashboard', 'manage_companies'],
  Staff: ['view_dashboard'],
};

async function seed() {
  console.log('🌱 Starting seed...');

  await AppDataSource.initialize();
  console.log('📦 Database connected');

  const permissionRepo = AppDataSource.getRepository(Permission);
  const roleRepo = AppDataSource.getRepository(Role);
  const rolePermissionRepo = AppDataSource.getRepository(RolePermission);
  const userRepo = AppDataSource.getRepository(User);
  const userRoleRepo = AppDataSource.getRepository(UserRole);

  // 1. Seed permissions
  console.log('🔑 Seeding permissions...');
  const permissionMap = new Map<string, Permission>();
  for (const perm of PERMISSIONS) {
    let existing = await permissionRepo.findOne({
      where: { name: perm.name },
    });
    if (!existing) {
      existing = await permissionRepo.save(permissionRepo.create(perm));
      console.log(`  ✅ Created permission: ${perm.name}`);
    } else {
      console.log(`  ⏭️  Permission exists: ${perm.name}`);
    }
    permissionMap.set(perm.name, existing);
  }

  // 2. Seed roles
  console.log('👥 Seeding roles...');
  const roleMap = new Map<string, Role>();
  for (const role of ROLES) {
    let existing = await roleRepo.findOne({ where: { name: role.name } });
    if (!existing) {
      existing = await roleRepo.save(roleRepo.create(role));
      console.log(`  ✅ Created role: ${role.name}`);
    } else {
      console.log(`  ⏭️  Role exists: ${role.name}`);
    }
    roleMap.set(role.name, existing);
  }

  // 3. Assign permissions to roles
  console.log('🔗 Assigning permissions to roles...');
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleMap.get(roleName)!;
    for (const permName of permNames) {
      const permission = permissionMap.get(permName)!;
      const existing = await rolePermissionRepo.findOne({
        where: { role_id: role.id, permission_id: permission.id },
      });
      if (!existing) {
        await rolePermissionRepo.save(
          rolePermissionRepo.create({
            role_id: role.id,
            permission_id: permission.id,
          }),
        );
        console.log(`  ✅ ${roleName} → ${permName}`);
      } else {
        console.log(`  ⏭️  ${roleName} → ${permName} (exists)`);
      }
    }
  }

  // 4. Seed super admin user
  console.log('🦸 Seeding super admin user...');
  let adminUser = await userRepo.findOne({
    where: { email: 'admin@etss.com' },
  });
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash('password123', 12);
    adminUser = await userRepo.save(
      userRepo.create({
        first_name: 'Super',
        last_name: 'Admin',
        email: 'admin@etss.com',
        password: hashedPassword,
        is_super_admin: true,
        is_active: true,
      }),
    );
    console.log('  ✅ Created super admin: admin@etss.com');
  } else {
    console.log('  ⏭️  Super admin exists: admin@etss.com');
  }

  // 5. Assign Super Admin role to the admin user
  console.log('🎯 Assigning Super Admin role...');
  const superAdminRole = roleMap.get('Super Admin')!;
  const existingUserRole = await userRoleRepo.findOne({
    where: { user_id: adminUser.id, role_id: superAdminRole.id },
  });
  if (!existingUserRole) {
    await userRoleRepo.save(
      userRoleRepo.create({
        user_id: adminUser.id,
        role_id: superAdminRole.id,
      }),
    );
    console.log('  ✅ Super Admin role assigned to admin@etss.com');
  } else {
    console.log('  ⏭️  Super Admin role already assigned');
  }

  console.log('\n🎉 Seed completed successfully!');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
