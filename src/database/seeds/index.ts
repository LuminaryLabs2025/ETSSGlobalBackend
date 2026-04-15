import 'reflect-metadata';
import * as dotenv from 'dotenv';

dotenv.config();

import { createSeedDataSource } from './seed-data-source';
import { runUserTypesSeed } from './runners/user-types.runner';
import {
  runPermissionModulesSeed,
  cleanupLegacyPermissionModule,
} from './runners/permission-modules.runner';
import { runPermissionsSeed } from './runners/permissions.runner';
import { runUserTypePermissionsSeed } from './runners/user-type-permissions.runner';
import { runSuperAdminSeed } from './runners/super-admin.runner';
import { backfillUserPermissionsFromTypes } from './runners/backfill-user-permissions.runner';
import { runAppOptionsSeed } from './runners/app-options.runner';

async function runAllSeeds(): Promise<void> {
  console.log('🌱 Maritime ETSS — running all seeds\n');

  const dataSource = createSeedDataSource();
  await dataSource.initialize();
  console.log('📦 Database connected\n');

  try {
    const userTypeMap = await runUserTypesSeed(dataSource);
    const permissionModuleMap = await runPermissionModulesSeed(dataSource);
    const permissionMap = await runPermissionsSeed(
      dataSource,
      permissionModuleMap,
    );
    await cleanupLegacyPermissionModule(dataSource);
    await runUserTypePermissionsSeed(dataSource, userTypeMap, permissionMap);
    await runSuperAdminSeed(dataSource, userTypeMap);
    await backfillUserPermissionsFromTypes(dataSource);
    await runAppOptionsSeed(dataSource);

    console.log('\n🎉 All seeds completed successfully!');
  } finally {
    await dataSource.destroy();
  }
}

runAllSeeds().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
