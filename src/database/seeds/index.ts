import 'reflect-metadata';
import * as dotenv from 'dotenv';

dotenv.config();

import { createSeedDataSource } from './seed-data-source';
import { runUserTypesSeed } from './runners/user-types.runner';
import { runPermissionsSeed } from './runners/permissions.runner';
import { runRolesSeed } from './runners/roles.runner';
import { runRolePermissionsSeed } from './runners/role-permissions.runner';
import { runSuperAdminSeed } from './runners/super-admin.runner';

async function runAllSeeds(): Promise<void> {
  console.log('🌱 Maritime ETSS — running all seeds\n');

  const dataSource = createSeedDataSource();
  await dataSource.initialize();
  console.log('📦 Database connected\n');

  try {
    const userTypeMap = await runUserTypesSeed(dataSource);
    const permissionMap = await runPermissionsSeed(dataSource);
    const roleMap = await runRolesSeed(dataSource);
    await runRolePermissionsSeed(dataSource, roleMap, permissionMap);
    await runSuperAdminSeed(dataSource, userTypeMap, roleMap);

    console.log('\n🎉 All seeds completed successfully!');
  } finally {
    await dataSource.destroy();
  }
}

runAllSeeds().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
