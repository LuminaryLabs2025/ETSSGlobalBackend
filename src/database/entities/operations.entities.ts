import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  TruckCapacity,
  TruckLength,
  TruckType,
} from './app-options.entities';
import { Company } from './company.entity';
import { User } from './user.entity';

/**
 * Trucks registered under transporter accounts (Manage Trucks - Operations).
 * Registration lifecycle: UNVERIFIED -> VERIFICATION_REQUESTED -> MSS_VERIFIED,
 * with FLAGGED (unpaid penalties), DISABLED and ARCHIVED administrative states.
 */
@Entity('trucks')
@Unique('UQ_trucks_plate_number', ['plate_number'])
@Check(
  'CHK_trucks_registration_status',
  `"registration_status" IN ('MSS_VERIFIED', 'UNVERIFIED', 'VERIFICATION_REQUESTED', 'FLAGGED', 'DISABLED', 'ARCHIVED')`,
)
@Check(
  'CHK_trucks_truck_status',
  `"truck_status" IS NULL OR "truck_status" IN ('AVAILABLE', 'ON_TRIP', 'IN_FACILITY', 'MATCHED', 'GTG_FACILITY', 'LEFT_FACILITY', 'IN_PREGATE', 'GTG_PREGATE', 'LEFT_PREGATE', 'IN_TERMINAL', 'LEFT_TERMINAL')`,
)
@Check('CHK_trucks_visibility', `"visibility" IN ('PRIVATE', 'PUBLIC')`)
export class Truck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  plate_number: string;

  @Column({ type: 'uuid' })
  truck_type_id: string;

  @ManyToOne(() => TruckType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'truck_type_id' })
  truck_type: TruckType;

  @Column({ type: 'varchar', nullable: true })
  color: string | null;

  @Column({ type: 'varchar', nullable: true })
  chassis_number: string | null;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'uuid', nullable: true })
  truck_length_id: string | null;

  @ManyToOne(() => TruckLength, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'truck_length_id' })
  truck_length: TruckLength | null;

  @Column({ type: 'uuid', nullable: true })
  truck_capacity_id: string | null;

  @ManyToOne(() => TruckCapacity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'truck_capacity_id' })
  truck_capacity: TruckCapacity | null;

  @Column({ default: 'UNVERIFIED' })
  registration_status: string;

  @Column({ type: 'varchar', nullable: true })
  truck_status: string | null;

  @Column({ default: 'PRIVATE' })
  visibility: string;

  @Column({ type: 'varchar', nullable: true })
  mss_verification_number: string | null;

  @Column({ type: 'timestamp', nullable: true })
  verification_timestamp: Date | null;

  @Column({ type: 'varchar', nullable: true })
  rfid_tag_number: string | null;

  @Column({ type: 'uuid', nullable: true })
  transporter_company_id: string | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transporter_company_id' })
  transporter_company: Company | null;

  @Column({ type: 'varchar', nullable: true })
  registered_by_company_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  registered_by_user_name: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User | null;

  @Column({ type: 'varchar', nullable: true })
  disabled_by: string | null;

  @Column({ type: 'text', nullable: true })
  disable_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  disable_timestamp: Date | null;

  @OneToMany(() => TruckPenalty, (penalty) => penalty.truck)
  penalties: TruckPenalty[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * Penalties issued against trucks by enforcement officers, including the
 * dispute lifecycle managed by SuperAdmins (Manage Disputes).
 */
@Entity('truck_penalties')
@Unique('UQ_truck_penalties_penalty_code', ['penalty_code'])
@Check(
  'CHK_truck_penalties_penalty_type',
  `"penalty_type" IN ('OVERSTAY', 'ROUTE_VIOLATION', 'UNAUTHORIZED_PARKING', 'OVERWEIGHT', 'CONTRABAND')`,
)
@Check(
  'CHK_truck_penalties_payment_status',
  `"payment_status" IN ('UNPAID', 'PAID', 'OVERRIDDEN', 'DISPUTED')`,
)
@Check(
  'CHK_truck_penalties_dispute_status',
  `"dispute_status" IS NULL OR "dispute_status" IN ('PENDING_REVIEW', 'UNDER_NPA_REVIEW', 'RESOLVED', 'REJECTED')`,
)
@Check(
  'CHK_truck_penalties_resolution_outcome',
  `"resolution_outcome" IS NULL OR "resolution_outcome" IN ('FINE_UPHELD', 'FINE_WAIVED', 'FINE_ADJUSTED')`,
)
export class TruckPenalty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Public penalty reference, e.g. PEN-2026-00117. */
  @Column()
  penalty_code: string;

  @Column({ type: 'uuid' })
  truck_id: string;

  @ManyToOne(() => Truck, (truck) => truck.penalties, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'truck_id' })
  truck: Truck;

  @Column()
  penalty_type: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date_issued: Date;

  @Column()
  issued_by: string;

  @Column({ default: 'UNPAID' })
  payment_status: string;

  @Column({ type: 'varchar', nullable: true })
  booked_by_company_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  booked_by_user_name: string | null;

  @Column({ type: 'text', nullable: true })
  dispute_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  date_disputed: Date | null;

  @Column({ type: 'varchar', nullable: true })
  dispute_status: string | null;

  @Column({ type: 'varchar', nullable: true })
  resolution_outcome: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  adjusted_amount: string | null;

  @Column({ type: 'varchar', nullable: true })
  managed_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resolution_date: Date | null;

  @Column({ type: 'varchar', nullable: true })
  overridden_by: string | null;

  @Column({ type: 'text', nullable: true })
  override_reason: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * Drivers registered under transporter accounts (Manage Drivers - Operations).
 */
@Entity('drivers')
@Unique('UQ_drivers_license_number', ['license_number'])
@Check(
  'CHK_drivers_verification_status',
  `"verification_status" IN ('VERIFIED', 'UNVERIFIED', 'VERIFICATION_IN_PROGRESS', 'FLAGGED', 'DISABLED', 'ARCHIVED')`,
)
@Check(
  'CHK_drivers_operational_status',
  `"operational_status" IS NULL OR "operational_status" IN ('AVAILABLE', 'ON_TRIP', 'IN_FACILITY', 'IN_PREGATE', 'IN_TERMINAL', 'OFF_DUTY', 'SUSPENDED')`,
)
@Check('CHK_drivers_sex', `"sex" IS NULL OR "sex" IN ('MALE', 'FEMALE')`)
@Check('CHK_drivers_visibility', `"visibility" IN ('PRIVATE', 'PUBLIC')`)
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ type: 'varchar', nullable: true })
  mobile_number: string | null;

  @Column()
  license_number: string;

  @Column({ type: 'date' })
  license_expiry_date: string;

  @Column({ type: 'date', nullable: true })
  date_of_birth: string | null;

  @Column({ type: 'varchar', nullable: true })
  sex: string | null;

  @Column({ default: 'UNVERIFIED' })
  verification_status: string;

  @Column({ type: 'timestamp', nullable: true })
  verification_timestamp: Date | null;

  @Column({ type: 'varchar', nullable: true })
  operational_status: string | null;

  @Column({ default: 'PRIVATE' })
  visibility: string;

  @Column({ type: 'uuid', nullable: true })
  transporter_company_id: string | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transporter_company_id' })
  transporter_company: Company | null;

  @Column({ type: 'varchar', nullable: true })
  registered_by_company_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  registered_by_user_name: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User | null;

  @Column({ type: 'varchar', nullable: true })
  disabled_by: string | null;

  @Column({ type: 'text', nullable: true })
  disable_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  disable_timestamp: Date | null;

  @OneToMany(() => DriverFlag, (flag) => flag.driver)
  flags: DriverFlag[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * Flags raised against drivers (penalties/incidents while on a trip).
 */
@Entity('driver_flags')
@Unique('UQ_driver_flags_flag_code', ['flag_code'])
@Check(
  'CHK_driver_flags_flag_type',
  `"flag_type" IN ('TRAFFIC_VIOLATION', 'MISCONDUCT', 'ACCIDENT', 'UNAUTHORIZED_ROUTE', 'EXPIRED_LICENSE', 'CUSTOMER_COMPLAINT')`,
)
@Check(
  'CHK_driver_flags_flag_status',
  `"flag_status" IN ('ACTIVE', 'CLEARED', 'UNDER_REVIEW')`,
)
export class DriverFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Public flag reference, e.g. FLG-DRV-00117. */
  @Column()
  flag_code: string;

  @Column({ type: 'uuid' })
  driver_id: string;

  @ManyToOne(() => Driver, (driver) => driver.flags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column()
  flag_type: string;

  @Column({ type: 'text', nullable: true })
  flag_details: string | null;

  @Column()
  flagged_by: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  flagged_at: Date;

  @Column({ default: 'ACTIVE' })
  flag_status: string;

  @Column({ type: 'varchar', nullable: true })
  cleared_by: string | null;

  @Column({ type: 'text', nullable: true })
  clear_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cleared_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}

/**
 * Truck Entry Permits uploaded by shipping lines, terminals and EPTs
 * (Manage TEPs - Operations). Source is derived from classification.
 */
@Entity('teps')
@Unique('UQ_teps_reference_number', ['reference_number'])
@Check(
  'CHK_teps_classification',
  `"classification" IN ('EMPTY_TDO', 'IMPORT_TDO', 'EXPORT_TDO', 'GATEPASS_PORT', 'GATEPASS_NON_PORT')`,
)
@Check(
  'CHK_teps_source',
  `"source" IN ('SHIPPING_LINE', 'PORT_TERMINAL', 'NON_PORT_TERMINAL', 'EPT')`,
)
@Check(
  'CHK_teps_match_status',
  `"match_status" IN ('MATCHED', 'UNMATCHED')`,
)
@Check('CHK_teps_status', `"status" IN ('ACTIVE', 'EXPIRED', 'REVOKED')`)
export class Tep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reference_number: string;

  @Column()
  classification: string;

  @Column()
  source: string;

  @Column()
  facility_name: string;

  @Column({ type: 'varchar', nullable: true })
  company_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  user_account: string | null;

  @Column({ type: 'varchar', nullable: true })
  truck_plate_number: string | null;

  @Column({ default: 'UNMATCHED' })
  match_status: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  expiry_date: Date | null;

  @Column({ type: 'varchar', nullable: true })
  revoked_by: string | null;

  @Column({ type: 'text', nullable: true })
  revoke_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User | null;

  @OneToMany(() => TepMatchedTruck, (matched) => matched.tep)
  matched_trucks: TepMatchedTruck[];

  @OneToMany(() => TepActivityEvent, (event) => event.tep)
  activity_events: TepActivityEvent[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/** Trucks matched against a TEP by transporters. */
@Entity('tep_matched_trucks')
export class TepMatchedTruck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tep_id: string;

  @ManyToOne(() => Tep, (tep) => tep.matched_trucks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tep_id' })
  tep: Tep;

  @Column()
  plate_number: string;

  @Column({ type: 'varchar', nullable: true })
  driver_name: string | null;

  @Column({ type: 'uuid', nullable: true })
  driver_id: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  match_timestamp: Date;
}

/** Audit trail of events on a TEP (rendered as activity_log on the frontend). */
@Entity('tep_activity_events')
@Check(
  'CHK_tep_activity_events_event_type',
  `"event_type" IN ('CREATED', 'UPDATED', 'VALIDATED', 'MATCHED', 'UNMATCHED', 'REVOKED', 'EXPIRED')`,
)
export class TepActivityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tep_id: string;

  @ManyToOne(() => Tep, (tep) => tep.activity_events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tep_id' })
  tep: Tep;

  @Column()
  event_type: string;

  @Column()
  performed_by: string;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn()
  created_at: Date;
}
