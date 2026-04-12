import { DataSource } from 'typeorm';
import { User } from '../../entities/user.entity';
import { UserPermission } from '../../entities/user-permission.entity';
import { UserTypePermission } from '../../entities/user-type-permission.entity';

/**
 * Users with no explicit `user_permissions` rows get a full copy of their type's
 * allowed permissions (same as default team-member / primary-user behaviour).
 */
export async function backfillUserPermissionsFromTypes(
  dataSource: DataSource,
): Promise<void> {
  console.log('\n📋 Backfilling user_permissions from user types...');
  const userRepo = dataSource.getRepository(User);
  const upRepo = dataSource.getRepository(UserPermission);
  const utpRepo = dataSource.getRepository(UserTypePermission);

  const users = await userRepo.find({
    where: {},
    select: ['id', 'user_type_id', 'is_super_admin'],
  });

  for (const u of users) {
    if (!u.user_type_id || u.is_super_admin) continue;
    const existingCount = await upRepo.count({ where: { user_id: u.id } });
    if (existingCount > 0) continue;

    const links = await utpRepo.find({
      where: { user_type_id: u.user_type_id },
    });
    if (links.length === 0) continue;

    for (const link of links) {
      await upRepo.save(
        upRepo.create({
          user_id: u.id,
          permission_id: link.permission_id,
        }),
      );
    }
    console.log(`  ✅ Backfilled permissions for user ${u.id}`);
  }
}
