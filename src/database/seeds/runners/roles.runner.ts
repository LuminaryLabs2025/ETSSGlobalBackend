import { DataSource } from 'typeorm';
import { Role } from '../../entities/role.entity';
import { ROLE_SEEDS } from '../data/role-seeds';

export async function runRolesSeed(
  dataSource: DataSource,
): Promise<Map<string, Role>> {
  console.log('\n👥 Seeding roles...');
  const roleRepo = dataSource.getRepository(Role);
  const roleMap = new Map<string, Role>();

  for (const role of ROLE_SEEDS) {
    let existing = await roleRepo.findOne({ where: { name: role.name } });
    if (!existing) {
      existing = await roleRepo.save(roleRepo.create(role));
      console.log(`  ✅ Created role: ${role.name}`);
    } else {
      console.log(`  ⏭️  Role exists: ${role.name}`);
    }
    roleMap.set(role.name, existing);
  }

  return roleMap;
}
