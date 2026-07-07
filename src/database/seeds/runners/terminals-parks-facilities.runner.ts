import { DataSource } from 'typeorm';
import {
  Facility,
  FacilityTimeslot,
  FacilityTimeslotAssignment,
  Location,
  Terminal,
  TransitPark,
} from '../../entities';
import { TERMINALS_PARKS_FACILITIES_SEEDS } from '../data/terminals-parks-facilities-seeds';

export async function runTerminalsParksFacilitiesSeed(
  dataSource: DataSource,
): Promise<void> {
  console.log('\n🏗️ Seeding terminals, transit parks and facilities...');

  const terminalRepo = dataSource.getRepository(Terminal);
  for (const seed of TERMINALS_PARKS_FACILITIES_SEEDS.terminals) {
    const existing = await terminalRepo.findOne({ where: { name: seed.name } });
    if (!existing) {
      await terminalRepo.save(terminalRepo.create(seed));
      console.log(`  ✅ Created terminal: ${seed.name}`);
    } else {
      console.log(`  ⏭️ Terminal already exists: ${seed.name}`);
    }
  }

  const transitParkRepo = dataSource.getRepository(TransitPark);
  for (const seed of TERMINALS_PARKS_FACILITIES_SEEDS.transit_parks) {
    const existing = await transitParkRepo.findOne({
      where: { name: seed.name },
    });
    if (!existing) {
      await transitParkRepo.save(transitParkRepo.create(seed));
      console.log(`  ✅ Created transit park: ${seed.name}`);
    } else {
      console.log(`  ⏭️ Transit park already exists: ${seed.name}`);
    }
  }

  const facilityRepo = dataSource.getRepository(Facility);
  const locationRepo = dataSource.getRepository(Location);
  const timeslotRepo = dataSource.getRepository(FacilityTimeslot);
  const assignmentRepo = dataSource.getRepository(FacilityTimeslotAssignment);
  const timeslots = await timeslotRepo.find();

  for (const seed of TERMINALS_PARKS_FACILITIES_SEEDS.facilities) {
    let facility = await facilityRepo.findOne({ where: { name: seed.name } });
    if (!facility) {
      facility = await facilityRepo.save(facilityRepo.create(seed));
      console.log(`  ✅ Created facility: ${seed.name}`);
    } else {
      console.log(`  ⏭️ Facility already exists: ${seed.name}`);
    }

    // Mirror the create-facility flow: FACILITY location + all timeslots.
    let location = await locationRepo.findOne({
      where: { type: 'FACILITY', reference_id: facility.id },
    });
    if (!location) {
      location = await locationRepo.save(
        locationRepo.create({
          name: facility.name,
          type: 'FACILITY',
          reference_id: facility.id,
        }),
      );
      console.log(`    📍 Created facility location: ${facility.name}`);
    }

    for (const timeslot of timeslots) {
      const existingAssignment = await assignmentRepo.findOne({
        where: { facility_id: location.id, timeslot_id: timeslot.id },
      });
      if (!existingAssignment) {
        await assignmentRepo.save(
          assignmentRepo.create({
            facility_id: location.id,
            timeslot_id: timeslot.id,
            is_active: true,
          }),
        );
      }
    }
  }
}
