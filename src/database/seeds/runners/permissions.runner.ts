import { DataSource } from 'typeorm';
import { Permission } from '../../entities/permission.entity';
import { PermissionModule } from '../../entities/permission-module.entity';
import { PERMISSION_SEEDS } from '../data/permission-seeds';

export async function runPermissionsSeed(
  dataSource: DataSource,
  moduleMap: Map<string, PermissionModule>,
): Promise<Map<string, Permission>> {
  console.log('\n🔑 Seeding permissions...');
  const permissionRepo = dataSource.getRepository(Permission);
  const permissionMap = new Map<string, Permission>();

  for (const perm of PERMISSION_SEEDS) {
    const mod = moduleMap.get(perm.moduleKey);
    if (!mod) {
      throw new Error(`Unknown permission module key: ${perm.moduleKey}`);
    }

    let existing = await permissionRepo.findOne({
      where: { name: perm.name },
    });
    if (!existing) {
      existing = await permissionRepo.save(
        permissionRepo.create({
          name: perm.name,
          description: perm.description,
          module_id: mod.id,
          sort_order: perm.sort_order,
        }),
      );
      console.log(`  ✅ Created permission: ${perm.name}`);
    } else {
      existing.description = perm.description;
      existing.module_id = mod.id;
      existing.sort_order = perm.sort_order;
      existing = await permissionRepo.save(existing);
      console.log(`  ⏭️  Updated permission: ${perm.name}`);
    }
    permissionMap.set(perm.name, existing);
  }

  return permissionMap;
}
