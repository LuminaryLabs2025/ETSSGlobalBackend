import { DataSource } from 'typeorm';
import { UserType } from '../../entities/user-type.entity';
import { Permission } from '../../entities/permission.entity';
import { UserTypePermission } from '../../entities/user-type-permission.entity';
import { USER_TYPE_PERMISSION_MAP } from '../data/user-type-permission-seeds';

export async function runUserTypePermissionsSeed(
  dataSource: DataSource,
  userTypeMap: Map<string, UserType>,
  permissionMap: Map<string, Permission>,
): Promise<void> {
  console.log('\n🔗 Seeding user type ↔ permission links...');
  const utpRepo = dataSource.getRepository(UserTypePermission);

  for (const [slug, permNames] of Object.entries(USER_TYPE_PERMISSION_MAP)) {
    const userType = userTypeMap.get(slug);
    if (!userType) {
      console.warn(`  ⚠️  Skip unknown user type slug: ${slug}`);
      continue;
    }

    const wantedIds = new Set<string>();
    for (const name of permNames) {
      const p = permissionMap.get(name);
      if (!p) {
        throw new Error(`Unknown permission name in map for ${slug}: ${name}`);
      }
      wantedIds.add(p.id);
    }

    const existing = await utpRepo.find({
      where: { user_type_id: userType.id },
    });
    const existingPermIds = new Set(existing.map((e) => e.permission_id));

    for (const permId of wantedIds) {
      if (existingPermIds.has(permId)) continue;
      await utpRepo.save(
        utpRepo.create({
          user_type_id: userType.id,
          permission_id: permId,
        }),
      );
      console.log(`  ✅ ${slug} → permission row`);
    }

    for (const row of existing) {
      if (!wantedIds.has(row.permission_id)) {
        await utpRepo.remove(row);
        console.log(`  🗑️  Removed stale type-permission for ${slug}`);
      }
    }
  }
}
