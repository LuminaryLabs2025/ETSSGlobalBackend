import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { UserType } from '../../entities/user-type.entity';
import { Role } from '../../entities/role.entity';
import { UserRole } from '../../entities/user-role.entity';
import { AccountType, UserStatus } from '../../../common/enums';
import { SUPER_ADMIN_SEED } from '../data/user-seeds';

export async function runSuperAdminSeed(
  dataSource: DataSource,
  userTypeMap: Map<string, UserType>,
  roleMap: Map<string, Role>,
): Promise<void> {
  console.log('\n🦸 Seeding super admin user...');
  const userRepo = dataSource.getRepository(User);
  const userRoleRepo = dataSource.getRepository(UserRole);

  const superAdminType = userTypeMap.get(SUPER_ADMIN_SEED.user_type_slug);
  let adminUser = await userRepo.findOne({
    where: { email: SUPER_ADMIN_SEED.email },
  });

  if (!adminUser) {
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_SEED.password, 12);
    const created = userRepo.create({
      first_name: SUPER_ADMIN_SEED.first_name,
      last_name: SUPER_ADMIN_SEED.last_name,
      email: SUPER_ADMIN_SEED.email,
      password: hashedPassword,
      is_super_admin: true,
      account_type: AccountType.SYSTEM,
      status: UserStatus.ACTIVE,
      user_type_id: superAdminType?.id ?? null,
    } as Partial<User>);
    adminUser = (await userRepo.save(created)) as User;
    console.log(`  ✅ Created super admin: ${SUPER_ADMIN_SEED.email}`);
  } else {
    if (superAdminType && !adminUser.user_type_id) {
      adminUser.user_type_id = superAdminType.id;
      adminUser.account_type = AccountType.SYSTEM;
      adminUser.status = UserStatus.ACTIVE;
      await userRepo.save(adminUser);
      console.log('  🔄 Updated super admin with user type');
    } else {
      console.log(`  ⏭️  Super admin exists: ${SUPER_ADMIN_SEED.email}`);
    }
  }

  console.log('\n🎯 Assigning Super Admin role...');
  const superAdminRole = roleMap.get(SUPER_ADMIN_SEED.role_name)!;
  const existingUserRole = await userRoleRepo.findOne({
    where: { user_id: adminUser!.id, role_id: superAdminRole.id },
  });
  if (!existingUserRole) {
    await userRoleRepo.save(
      userRoleRepo.create({
        user_id: adminUser!.id,
        role_id: superAdminRole.id,
      }),
    );
    console.log(
      `  ✅ ${SUPER_ADMIN_SEED.role_name} role assigned to ${SUPER_ADMIN_SEED.email}`,
    );
  } else {
    console.log(`  ⏭️  ${SUPER_ADMIN_SEED.role_name} role already assigned`);
  }
}
