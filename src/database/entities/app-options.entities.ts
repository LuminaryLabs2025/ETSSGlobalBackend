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
} from 'typeorm';
import { User } from './user.entity';
import { UserType } from './user-type.entity';

@Entity('truck_types')
@Unique('UQ_truck_types_name', ['name'])
export class TruckType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: 'ACTIVE' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => TruckCapacity, (capacity) => capacity.truck_type)
  capacities: TruckCapacity[];

  @OneToMany(() => TruckLength, (length) => length.truck_type)
  lengths: TruckLength[];

  @OneToMany(
    () => TruckTypeBookingCategory,
    (link) => link.truck_type,
  )
  booking_category_links: TruckTypeBookingCategory[];
}

@Entity('truck_capacities')
@Unique('UQ_truck_capacities_type_value', ['truck_type_id', 'capacity_value'])
export class TruckCapacity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  truck_type_id: string;

  @ManyToOne(() => TruckType, (truckType) => truckType.capacities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'truck_type_id' })
  truck_type: TruckType;

  @Column()
  capacity_value: string;

  @Column({ default: 'ACTIVE' })
  status: string;
}

@Entity('truck_lengths')
@Unique('UQ_truck_lengths_type_value', ['truck_type_id', 'length_value'])
export class TruckLength {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  truck_type_id: string;

  @ManyToOne(() => TruckType, (truckType) => truckType.lengths, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'truck_type_id' })
  truck_type: TruckType;

  @Column()
  length_value: string;

  @Column({ default: 'ACTIVE' })
  status: string;
}

@Entity('booking_categories')
@Unique('UQ_booking_categories_name', ['name'])
export class BookingCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'ACTIVE' })
  status: string;
}

@Entity('tep_types')
@Unique('UQ_tep_types_name', ['name'])
export class TepType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'ACTIVE' })
  status: string;
}

@Entity('tep_type_booking_categories')
@Unique('UQ_tep_type_booking_categories_unique', [
  'tep_type_id',
  'booking_category_id',
])
export class TepTypeBookingCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tep_type_id: string;

  @Column()
  booking_category_id: string;

  @ManyToOne(() => TepType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tep_type_id' })
  tep_type: TepType;

  @ManyToOne(() => BookingCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_category_id' })
  booking_category: BookingCategory;
}

@Entity('tep_type_truck_types')
@Unique('UQ_tep_type_truck_types_unique', ['tep_type_id', 'truck_type_id'])
export class TepTypeTruckType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tep_type_id: string;

  @Column()
  truck_type_id: string;

  @ManyToOne(() => TepType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tep_type_id' })
  tep_type: TepType;

  @ManyToOne(() => TruckType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'truck_type_id' })
  truck_type: TruckType;
}

@Entity('truck_type_booking_categories')
@Unique('UQ_truck_type_booking_categories_unique', [
  'truck_type_id',
  'booking_category_id',
])
export class TruckTypeBookingCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  truck_type_id: string;

  @Column()
  booking_category_id: string;

  @ManyToOne(() => TruckType, (truckType) => truckType.booking_category_links, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'truck_type_id' })
  truck_type: TruckType;

  @ManyToOne(() => BookingCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_category_id' })
  booking_category: BookingCategory;
}

@Entity('park_types')
@Unique('UQ_park_types_name', ['name'])
export class ParkType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'ACTIVE' })
  status: string;
}

@Entity('facility_types')
@Unique('UQ_facility_types_name', ['name'])
export class FacilityType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'ACTIVE' })
  status: string;
}

@Entity('facility_type_park_types')
@Unique('UQ_facility_type_park_types_unique', ['facility_type_id', 'park_type_id'])
export class FacilityTypeParkType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  facility_type_id: string;

  @Column()
  park_type_id: string;

  @ManyToOne(() => FacilityType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'facility_type_id' })
  facility_type: FacilityType;

  @ManyToOne(() => ParkType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'park_type_id' })
  park_type: ParkType;
}

@Entity('facility_timeslots')
@Unique('UQ_facility_timeslots_name', ['name'])
export class FacilityTimeslot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'time without time zone' })
  start_time: string;

  @Column({ type: 'time without time zone' })
  end_time: string;

  @Column({ default: 'ACTIVE' })
  status: string;
}

@Entity('locations')
@Unique('UQ_locations_name_type', ['name', 'type'])
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column({ type: 'uuid', nullable: true })
  reference_id: string | null;

  @OneToMany(() => FacilityTimeslotAssignment, (assignment) => assignment.location)
  facility_timeslot_assignments: FacilityTimeslotAssignment[];

  @OneToMany(() => HandheldDevice, (device) => device.location)
  handheld_devices: HandheldDevice[];
}

@Entity('facility_timeslot_assignments')
@Unique('UQ_facility_timeslot_assignments_unique', ['facility_id', 'timeslot_id'])
export class FacilityTimeslotAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  facility_id: string;

  @Column()
  timeslot_id: string;

  @ManyToOne(() => Location, (location) => location.facility_timeslot_assignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'facility_id' })
  location: Location;

  @ManyToOne(() => FacilityTimeslot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'timeslot_id' })
  timeslot: FacilityTimeslot;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}

@Entity('payment_types')
@Unique('UQ_payment_types_name', ['name'])
@Check(
  'CHK_payment_types_amount_type',
  `"amount_type" IN ('FIXED', 'DYNAMIC')`,
)
export class PaymentType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  service_name: string;

  @Column()
  linked_form: string;

  @Column()
  revenue_event_trigger: string;

  @Column()
  charged_to_user_type_id: string;

  @ManyToOne(() => UserType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'charged_to_user_type_id' })
  charged_to_user_type: UserType;

  @Column({ default: 'FIXED' })
  amount_type: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  amount: number | null;

  @Column({ default: 'ACTIVE' })
  status: string;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('infraction_categories')
@Unique('UQ_infraction_categories_name', ['name'])
export class InfractionCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  fine_amount: number;

  @Column({ default: 'ACTIVE' })
  status: string;
}

@Entity('terminal_gates')
@Unique('UQ_terminal_gates_entry_barrier_id', ['entry_barrier_id'])
@Unique('UQ_terminal_gates_exit_barrier_id', ['exit_barrier_id'])
export class TerminalGate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  location: string;

  @Column()
  entry_barrier_name: string;

  @Column()
  entry_barrier_id: string;

  @Column()
  exit_barrier_name: string;

  @Column()
  exit_barrier_id: string;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('handheld_devices')
@Unique('UQ_handheld_devices_name', ['name'])
export class HandheldDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column()
  location_id: string;

  @ManyToOne(() => Location, (location) => location.handheld_devices, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ default: 'ACTIVE' })
  status: string;
}

@Entity('rfid_tags')
@Unique('UQ_rfid_tags_rfid_tag_number', ['rfid_tag_number'])
@Unique('UQ_rfid_tags_etss_tag_number', ['etss_tag_number'])
export class RfidTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  rfid_tag_number: string;

  @Column()
  etss_tag_number: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  truck_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  transporter_name: string | null;

  @CreateDateColumn()
  created_at: Date;
}
