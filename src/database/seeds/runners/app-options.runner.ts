import { DataSource } from 'typeorm';
import {
  BookingCategory,
  FacilityTimeslot,
  FacilityType,
  ParkType,
  TepType,
  TruckType,
} from '../../entities';
import { APP_OPTIONS_SEEDS } from '../data/app-options-seeds';

export async function runAppOptionsSeed(dataSource: DataSource): Promise<void> {
  console.log('\n⚙️ Seeding app options...');

  const truckTypeRepo = dataSource.getRepository(TruckType);
  for (const seed of APP_OPTIONS_SEEDS.truck_types) {
    const existing = await truckTypeRepo.findOne({ where: { name: seed.name } });
    if (!existing) {
      await truckTypeRepo.save(truckTypeRepo.create(seed));
      console.log(`  ✅ Created truck type: ${seed.name}`);
    } else {
      existing.description = seed.description;
      existing.status = seed.status;
      await truckTypeRepo.save(existing);
      console.log(`  🔄 Updated truck type: ${seed.name}`);
    }
  }

  const bookingCategoryRepo = dataSource.getRepository(BookingCategory);
  for (const seed of APP_OPTIONS_SEEDS.booking_categories) {
    const existing = await bookingCategoryRepo.findOne({
      where: { name: seed.name },
    });
    if (!existing) {
      await bookingCategoryRepo.save(bookingCategoryRepo.create(seed));
      console.log(`  ✅ Created booking category: ${seed.name}`);
    } else {
      existing.status = seed.status;
      await bookingCategoryRepo.save(existing);
      console.log(`  🔄 Updated booking category: ${seed.name}`);
    }
  }

  const tepTypeRepo = dataSource.getRepository(TepType);
  for (const seed of APP_OPTIONS_SEEDS.tep_types) {
    const existing = await tepTypeRepo.findOne({ where: { name: seed.name } });
    if (!existing) {
      await tepTypeRepo.save(tepTypeRepo.create(seed));
      console.log(`  ✅ Created TEP type: ${seed.name}`);
    } else {
      existing.status = seed.status;
      await tepTypeRepo.save(existing);
      console.log(`  🔄 Updated TEP type: ${seed.name}`);
    }
  }

  const parkTypeRepo = dataSource.getRepository(ParkType);
  for (const seed of APP_OPTIONS_SEEDS.park_types) {
    const existing = await parkTypeRepo.findOne({ where: { name: seed.name } });
    if (!existing) {
      await parkTypeRepo.save(parkTypeRepo.create(seed));
      console.log(`  ✅ Created park type: ${seed.name}`);
    } else {
      existing.status = seed.status;
      await parkTypeRepo.save(existing);
      console.log(`  🔄 Updated park type: ${seed.name}`);
    }
  }

  const facilityTypeRepo = dataSource.getRepository(FacilityType);
  for (const seed of APP_OPTIONS_SEEDS.facility_types) {
    const existing = await facilityTypeRepo.findOne({ where: { name: seed.name } });
    if (!existing) {
      await facilityTypeRepo.save(facilityTypeRepo.create(seed));
      console.log(`  ✅ Created facility type: ${seed.name}`);
    } else {
      existing.status = seed.status;
      await facilityTypeRepo.save(existing);
      console.log(`  🔄 Updated facility type: ${seed.name}`);
    }
  }

  const facilityTimeslotRepo = dataSource.getRepository(FacilityTimeslot);
  for (const seed of APP_OPTIONS_SEEDS.facility_timeslots) {
    const existing = await facilityTimeslotRepo.findOne({ where: { name: seed.name } });
    if (!existing) {
      await facilityTimeslotRepo.save(facilityTimeslotRepo.create(seed));
      console.log(`  ✅ Created facility timeslot: ${seed.name}`);
    } else {
      existing.start_time = seed.start_time;
      existing.end_time = seed.end_time;
      existing.status = seed.status;
      await facilityTimeslotRepo.save(existing);
      console.log(`  🔄 Updated facility timeslot: ${seed.name}`);
    }
  }
}
