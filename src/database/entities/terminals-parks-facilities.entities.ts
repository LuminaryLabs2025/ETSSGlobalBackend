import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Port and Non-Port Terminals (e.g. APM Terminals, ENL Consortium).
 * Terminal codes are auto-generated as PT-001 / NPT-001 per terminal type.
 */
@Entity('terminals')
@Unique('UQ_terminals_name', ['name'])
@Unique('UQ_terminals_terminal_code', ['terminal_code'])
@Check(
  'CHK_terminals_terminal_type',
  `"terminal_type" IN ('PORT_TERMINAL', 'NON_PORT_TERMINAL')`,
)
@Check('CHK_terminals_location', `"location" IN ('APAPA', 'TINCAN')`)
@Check('CHK_terminals_status', `"status" IN ('ACTIVE', 'INACTIVE')`)
@Check('CHK_terminals_booking_status', `"booking_status" IN ('OPEN', 'CLOSED')`)
export class Terminal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  terminal_type: string;

  @Column()
  terminal_code: string;

  @Column()
  location: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'integer' })
  approved_daily_truck_capacity: number;

  @Column({ type: 'integer', nullable: true })
  approved_trucks_per_hour: number | null;

  @Column({ type: 'integer', nullable: true })
  hourly_truck_tat_minutes: number | null;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ default: 'OPEN' })
  booking_status: string;

  @Column({ type: 'timestamp', nullable: true })
  archived_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * Transit parks (PREGATE and EPT classes).
 * Codes are auto-generated as PRE-001 / EPT-001 per transit park type.
 */
@Entity('transit_parks')
@Unique('UQ_transit_parks_name', ['name'])
@Unique('UQ_transit_parks_transit_park_code', ['transit_park_code'])
@Check(
  'CHK_transit_parks_transit_park_type',
  `"transit_park_type" IN ('PREGATE', 'EPT')`,
)
@Check('CHK_transit_parks_location', `"location" IN ('APAPA', 'TINCAN')`)
@Check('CHK_transit_parks_status', `"status" IN ('ACTIVE', 'INACTIVE')`)
export class TransitPark {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  transit_park_type: string;

  @Column()
  transit_park_code: string;

  @Column()
  location: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'integer' })
  approved_truck_capacity: number;

  @Column({ type: 'integer' })
  approved_truck_exits_per_hour: number;

  @Column({ type: 'integer', nullable: true })
  bay_capacity: number | null;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  archived_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * Facilities: Bonded Terminals (empty container holding bays), Truck Parks
 * and Fish-Van Parks. Codes are auto-generated as BDT-001 / TRP-001 / FVP-001
 * per park type. Creating a facility also registers a FACILITY location and
 * auto-assigns all facility timeslots to it (MVP 022).
 */
@Entity('facilities')
@Unique('UQ_facilities_name', ['name'])
@Unique('UQ_facilities_facility_code', ['facility_code'])
@Check(
  'CHK_facilities_park_type',
  `"park_type" IN ('BONDED_TERMINAL', 'TRUCK_PARK', 'FISH_VAN_PARK')`,
)
@Check(
  'CHK_facilities_facility_type',
  `"facility_type" IN ('FACILITY', 'FACILITY_PREGATE')`,
)
@Check(
  'CHK_facilities_location',
  `"location" IN ('APAPA', 'TINCAN', 'APAPA_TINCAN')`,
)
@Check('CHK_facilities_status', `"status" IN ('ACTIVE', 'INACTIVE')`)
export class Facility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  park_type: string;

  @Column()
  facility_type: string;

  @Column()
  facility_code: string;

  @Column()
  location: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'integer' })
  approved_truck_capacity: number;

  @Column({ type: 'integer' })
  approved_truck_exits_per_hour: number;

  @Column({ type: 'integer', nullable: true })
  bay_capacity: number | null;

  @Column({ type: 'integer', nullable: true })
  daily_empty_evacuation_limit: number | null;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  archived_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
