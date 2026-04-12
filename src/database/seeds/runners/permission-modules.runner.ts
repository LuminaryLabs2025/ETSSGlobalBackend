import { DataSource } from 'typeorm';
import { PermissionModule } from '../../entities/permission-module.entity';
import { Permission } from '../../entities/permission.entity';
import { PERMISSION_MODULE_SEEDS } from '../data/permission-seeds';

export async function runPermissionModulesSeed(
  dataSource: DataSource,
): Promise<Map<string, PermissionModule>> {
  console.log('\n📁 Seeding permission modules...');
  const repo = dataSource.getRepository(PermissionModule);
  const map = new Map<string, PermissionModule>();

  for (const row of PERMISSION_MODULE_SEEDS) {
    let existing = await repo.findOne({ where: { key: row.key } });
    if (!existing) {
      existing = await repo.save(repo.create(row));
      console.log(`  ✅ Created module: ${row.key}`);
    } else {
      existing.name = row.name;
      existing.description = row.description;
      existing.sort_order = row.sort_order;
      existing.nav_section = row.nav_section;
      existing = await repo.save(existing);
      console.log(`  ⏭️  Updated module: ${row.key}`);
    }
    map.set(row.key, existing);
  }

  return map;
}

/** Removes migration placeholder row once no permissions reference it. */
export async function cleanupLegacyPermissionModule(
  dataSource: DataSource,
): Promise<void> {
  const legacy = await dataSource.getRepository(PermissionModule).findOne({
    where: { key: '__legacy' },
  });
  if (!legacy) return;
  const n = await dataSource.getRepository(Permission).count({
    where: { module_id: legacy.id },
  });
  if (n === 0) {
    await dataSource.getRepository(PermissionModule).delete(legacy.id);
    console.log('  🧹 Removed temporary __legacy permission module');
  }
}
