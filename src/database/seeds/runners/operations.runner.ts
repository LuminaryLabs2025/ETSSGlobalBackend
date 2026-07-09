import { DataSource } from 'typeorm';
import { Company } from '../../entities/company.entity';
import {
  Driver,
  DriverFlag,
  Tep,
  TepActivityEvent,
  TepMatchedTruck,
  Truck,
  TruckPenalty,
} from '../../entities/operations.entities';
import {
  DRIVER_SEEDS,
  TEP_SEEDS,
  TRANSPORTER_COMPANIES,
  TRUCK_SEEDS,
} from '../data/operations-seeds';
import { TEP_SOURCE_BY_CLASSIFICATION } from '../../../modules/operations/dto/operations.dto';

export async function runOperationsSeed(dataSource: DataSource): Promise<void> {
  console.log('  → Operations (trucks, drivers, TEPs, disputes)');

  const companyRepo = dataSource.getRepository(Company);
  const companyMap = new Map<string, Company>();

  for (const c of TRANSPORTER_COMPANIES) {
    let company = await companyRepo.findOne({ where: { name: c.name } });
    if (!company) {
      company = await companyRepo.save(companyRepo.create({ name: c.name }));
    }
    companyMap.set(c.name, company);
  }

  const truckRepo = dataSource.getRepository(Truck);
  const penaltyRepo = dataSource.getRepository(TruckPenalty);

  for (const seed of TRUCK_SEEDS) {
    let truck = await truckRepo.findOne({
      where: { plate_number: seed.plate_number },
    });
    if (!truck) {
      const company = companyMap.get(seed.company);
      truck = truckRepo.create({
        plate_number: seed.plate_number,
        truck_type: seed.truck_type,
        color: seed.color ?? null,
        chassis_number: seed.chassis_number ?? null,
        brand: seed.brand ?? null,
        model: seed.model ?? null,
        truck_length: seed.truck_length ?? null,
        truck_capacity: seed.truck_capacity ?? null,
        registration_status: seed.registration_status,
        truck_status: seed.truck_status ?? null,
        visibility: seed.visibility,
        mss_verification_number: seed.mss_verification_number ?? null,
        verification_timestamp: seed.mss_verification_number
          ? new Date('2024-02-15T10:30:00Z')
          : null,
        rfid_tag_number: seed.rfid_tag_number ?? null,
        transporter_company_id: company?.id ?? null,
        registered_by_company_name: seed.company,
        registered_by_user_name: seed.user,
        disabled_by: seed.disabled_by ?? null,
        disable_reason: seed.disable_reason ?? null,
        disable_timestamp: seed.disabled_by ? new Date() : null,
      });
      truck = await truckRepo.save(truck);
    }

    if (seed.penalty) {
      const exists = await penaltyRepo.findOne({
        where: { penalty_code: seed.penalty.penalty_code },
      });
      if (!exists) {
        await penaltyRepo.save(
          penaltyRepo.create({
            ...seed.penalty,
            truck_id: truck.id,
            booked_by_company_name: seed.company,
            booked_by_user_name: seed.user,
            date_disputed:
              seed.penalty.payment_status === 'DISPUTED' ? new Date() : null,
          }),
        );
      }
    }
  }

  const driverRepo = dataSource.getRepository(Driver);
  const flagRepo = dataSource.getRepository(DriverFlag);

  for (const seed of DRIVER_SEEDS) {
    let driver = await driverRepo.findOne({
      where: { license_number: seed.license_number },
    });
    if (!driver) {
      const company = companyMap.get(seed.company);
      driver = driverRepo.create({
        first_name: seed.first_name,
        last_name: seed.last_name,
        mobile_number: seed.mobile_number,
        license_number: seed.license_number,
        license_expiry_date: seed.license_expiry_date,
        date_of_birth: seed.date_of_birth,
        sex: seed.sex,
        verification_status: seed.verification_status,
        verification_timestamp:
          seed.verification_status === 'VERIFIED' ? new Date() : null,
        operational_status: seed.operational_status ?? null,
        visibility: seed.visibility,
        transporter_company_id: company?.id ?? null,
        registered_by_company_name: seed.company,
        registered_by_user_name: seed.user,
        disabled_by: seed.disabled_by ?? null,
        disable_reason: seed.disable_reason ?? null,
        disable_timestamp: seed.disabled_by ? new Date() : null,
      });
      driver = await driverRepo.save(driver);
    }

    if (seed.flag) {
      const exists = await flagRepo.findOne({
        where: { flag_code: seed.flag.flag_code },
      });
      if (!exists) {
        await flagRepo.save(
          flagRepo.create({ ...seed.flag, driver_id: driver.id }),
        );
      }
    }
  }

  const tepRepo = dataSource.getRepository(Tep);
  const matchRepo = dataSource.getRepository(TepMatchedTruck);
  const eventRepo = dataSource.getRepository(TepActivityEvent);

  for (const seed of TEP_SEEDS) {
    let tep = await tepRepo.findOne({
      where: { reference_number: seed.reference_number },
    });
    if (!tep) {
      tep = await tepRepo.save(
        tepRepo.create({
          reference_number: seed.reference_number,
          classification: seed.classification,
          source: TEP_SOURCE_BY_CLASSIFICATION[seed.classification],
          facility_name: seed.facility_name,
          company_name: seed.company_name,
          user_account: 'SuperAdmin',
          truck_plate_number: seed.truck_plate_number ?? null,
          match_status: seed.match_status,
          status: seed.status,
          expiry_date:
            seed.status === 'EXPIRED' ? new Date('2026-01-01T00:00:00Z') : null,
          revoked_by: seed.status === 'REVOKED' ? 'SuperAdmin' : null,
          revoke_reason:
            seed.status === 'REVOKED' ? 'Invalid documentation' : null,
          revoked_at: seed.status === 'REVOKED' ? new Date() : null,
        }),
      );

      await eventRepo.save(
        eventRepo.create({
          tep_id: tep.id,
          event_type: 'CREATED',
          performed_by: 'SuperAdmin',
          details: 'TEP created via seed',
        }),
      );

      if (seed.matched) {
        await matchRepo.save(
          matchRepo.create({
            tep_id: tep.id,
            plate_number: seed.matched.plate_number,
            driver_name: seed.matched.driver_name,
          }),
        );
        await eventRepo.save(
          eventRepo.create({
            tep_id: tep.id,
            event_type: 'MATCHED',
            performed_by: seed.matched.driver_name,
            details: `Matched to ${seed.matched.plate_number}`,
          }),
        );
      }
    }
  }

  console.log('    ✓ Operations seed complete');
}
