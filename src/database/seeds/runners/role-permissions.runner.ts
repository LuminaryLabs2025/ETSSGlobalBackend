import { DataSource } from 'typeorm';
import { RolePermission } from '../../entities/role-permission.entity';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { ROLE_PERMISSION_MAP } from '../data/role-seeds';

export async function runRolePermissionsSeed(
  dataSource: DataSource,
  roleMap: Map<string, Role>,
  permissionMap: Map<string, Permission>,
): Promise<void> {
  console.log('\n🔗 Assigning permissions to roles...');
  const rolePermissionRepo = dataSource.getRepository(RolePermission);

  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSION_MAP)) {
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
}
