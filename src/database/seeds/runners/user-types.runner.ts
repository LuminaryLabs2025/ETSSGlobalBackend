import { DataSource } from 'typeorm';
import { UserType } from '../../entities/user-type.entity';
import { USER_TYPE_SEEDS } from '../data/user-type-seeds';

export async function runUserTypesSeed(
  dataSource: DataSource,
): Promise<Map<string, UserType>> {
  console.log('📋 Seeding user types...');
  const userTypeRepo = dataSource.getRepository(UserType);
  const userTypeMap = new Map<string, UserType>();

  for (const seed of USER_TYPE_SEEDS) {
    let existing = await userTypeRepo.findOne({
      where: { slug: seed.slug },
    });
    if (!existing) {
      const created = userTypeRepo.create({
        name: seed.name,
        slug: seed.slug,
        category: seed.category,
        metadata: seed.metadata,
      } as Partial<UserType>);
      existing = (await userTypeRepo.save(created)) as UserType;
      console.log(`  ✅ Created user type: ${seed.name}`);
    } else {
      existing.metadata = seed.metadata;
      existing.name = seed.name;
      await userTypeRepo.save(existing);
      console.log(`  🔄 Updated user type: ${seed.name}`);
    }
    userTypeMap.set(seed.slug, existing);
  }

  return userTypeMap;
}
