import { DataSource } from 'typeorm';
import { Permission } from '../../entities/permission.entity';
import { PERMISSION_SEEDS } from '../data/permission-seeds';

export async function runPermissionsSeed(
  dataSource: DataSource,
): Promise<Map<string, Permission>> {
  console.log('\n🔑 Seeding permissions...');
  const permissionRepo = dataSource.getRepository(Permission);
  const permissionMap = new Map<string, Permission>();

  for (const perm of PERMISSION_SEEDS) {
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

  return permissionMap;
}
