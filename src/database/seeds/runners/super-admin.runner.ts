import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { UserType } from '../../entities/user-type.entity';
import { Company } from '../../entities/company.entity';
import { AccountType, UserStatus } from '../../../common/enums';
import { SUPER_ADMIN_SEED } from '../data/user-seeds';
import { MARITIME_ETSS_COMPANY_NAME } from '../../../common/constants/companies';

export async function runSuperAdminSeed(
  dataSource: DataSource,
  userTypeMap: Map<string, UserType>,
): Promise<void> {
  console.log('\n🦸 Seeding super admin user...');
  const userRepo = dataSource.getRepository(User);
  const companyRepo = dataSource.getRepository(Company);

  let platformCompany = await companyRepo.findOne({
    where: { name: MARITIME_ETSS_COMPANY_NAME },
  });
  if (!platformCompany) {
    platformCompany = await companyRepo.save(
      companyRepo.create({
        name: MARITIME_ETSS_COMPANY_NAME,
        is_active: true,
      }),
    );
    console.log(`  ✅ Created platform company: ${MARITIME_ETSS_COMPANY_NAME}`);
  }

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
      company_id: platformCompany.id,
    } as Partial<User>);
    adminUser = (await userRepo.save(created)) as User;
    console.log(`  ✅ Created super admin: ${SUPER_ADMIN_SEED.email}`);
  } else {
    let changed = false;
    if (superAdminType && !adminUser.user_type_id) {
      adminUser.user_type_id = superAdminType.id;
      adminUser.account_type = AccountType.SYSTEM;
      adminUser.status = UserStatus.ACTIVE;
      changed = true;
    }
    if (!adminUser.company_id) {
      adminUser.company_id = platformCompany.id;
      changed = true;
    }
    if (changed) {
      await userRepo.save(adminUser);
      console.log('  🔄 Updated super admin (user type / company)');
    } else {
      console.log(`  ⏭️  Super admin exists: ${SUPER_ADMIN_SEED.email}`);
    }
  }
}
