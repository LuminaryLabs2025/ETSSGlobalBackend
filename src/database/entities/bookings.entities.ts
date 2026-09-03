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
  Facility,
  Terminal,
  TransitPark,
} from './terminals-parks-facilities.entities';
import { BookingCategory, FacilityTimeslot } from './app-options.entities';
import { Truck, Driver, Tep } from './operations.entities';
import { Company } from './company.entity';
import { User } from './user.entity';

/**
 * Truck bookings across the platform (Manage Bookings). Also drives Today's
 * Manifest: IN_MANIFEST (LEFT-PREGATE trucks) and LEFT_MANIFEST (trucks that
 * requested a tow truck).
 */
@Entity('bookings')
@Unique('UQ_bookings_booking_id', ['booking_id'])
@Check(
  'CHK_bookings_status',
  `"status" IN ('LIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED')`,
)
@Check(
  'CHK_bookings_transfer_type',
  `"transfer_type" IN ('INBOUND', 'OUTBOUND', 'INTER_TERMINAL', 'EMPTY_RETURN', 'LOCAL')`,
)
@Check(
  'CHK_bookings_category',
  `"booking_category" IN ('IMPORT', 'EXPORT', 'EMPTY', 'DOMESTIC')`,
)
@Check(
  'CHK_bookings_manifest_status',
  `"manifest_status" IS NULL OR "manifest_status" IN ('IN_MANIFEST', 'LEFT_MANIFEST')`,
)
@Check(
  'CHK_bookings_booking_type',
  `"booking_type" IS NULL OR "booking_type" IN ('BONDED_TERMINAL', 'TRUCK_PARK', 'FISH_VAN_PARK', 'EPT')`,
)
@Check(
  'CHK_bookings_export_type',
  `"export_type" IS NULL OR "export_type" IN ('AGRO_EXPORT', 'MANUFACTURED_EXPORT', 'OTHERS')`,
)
@Check(
  'CHK_bookings_ept_operation_type',
  `"ept_operation_type" IS NULL OR "ept_operation_type" IN ('LOADED_EXPORT_DELIVERY', 'EMPTY_CONTAINER_DELIVERY', 'VERIFIED_EXPORT_COLLECTION', 'LOADED_DELIVERY_WITH_COLLECTION')`,
)
@Check(
  'CHK_bookings_priority_level',
  `"priority_level" IN ('HIGH', 'MEDIUM', 'LOW')`,
)
@Check(
  'CHK_bookings_payment_status',
  `"payment_status" IN ('PENDING', 'PAID', 'FAILED')`,
)
@Check(
  'CHK_bookings_payment_method',
  `"payment_method" IS NULL OR "payment_method" IN ('WALLET', 'PAYSTACK')`,
)
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  booking_id: string;

  @Column()
  journey_code: string;

  @Column()
  truck_plate_number: string;

  @Column({ type: 'varchar', nullable: true })
  truck_color: string | null;

  @Column()
  driver_name: string;

  @Column({ type: 'varchar', nullable: true })
  driver_id: string | null;

  @Column()
  transporter_company: string;

  @Column()
  terminal_name: string;

  @Column()
  terminal_destination: string;

  @Column()
  transfer_type: string;

  @Column()
  booking_category: string;

  @Column({ default: 'LIVE' })
  status: string;

  @Column()
  truck_booked_by: string;

  @Column()
  truck_owned_by: string;

  @Column({ type: 'timestamp', nullable: true })
  left_pregate_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  left_manifest_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  manifest_status: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  // ── Tow truck request (only present on LEFT_MANIFEST trucks) ──
  @Column({ type: 'timestamp', nullable: true })
  tow_requested_at: Date | null;

  @Column({ type: 'text', nullable: true })
  tow_reason: string | null;

  @Column({ type: 'varchar', nullable: true })
  tow_requested_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  tow_company: string | null;

  @Column({ type: 'varchar', nullable: true })
  tow_status: string | null;

  // ── SuperAdmin booking-creation flows (Bonded Terminal / Truck Park /
  // Fish / EPT). All nullable — legacy rows and the denormalized display
  // columns above are untouched. ──
  @Column({ type: 'varchar', nullable: true })
  booking_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  facility_id: string | null;

  @ManyToOne(() => Facility, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility: Facility | null;

  @Column({ type: 'uuid', nullable: true })
  transit_park_id: string | null;

  @ManyToOne(() => TransitPark, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transit_park_id' })
  transit_park: TransitPark | null;

  /** Set only by the mark-in-pregate manual-trigger step, not at creation. */
  @Column({ type: 'uuid', nullable: true })
  pregate_transit_park_id: string | null;

  @ManyToOne(() => TransitPark, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pregate_transit_park_id' })
  pregate_transit_park: TransitPark | null;

  @Column({ type: 'uuid', nullable: true })
  terminal_id: string | null;

  @ManyToOne(() => Terminal, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'terminal_id' })
  terminal: Terminal | null;

  @Column({ type: 'uuid', nullable: true })
  truck_id: string | null;

  @ManyToOne(() => Truck, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'truck_id' })
  truck_ref: Truck | null;

  @Column({ type: 'uuid', nullable: true })
  driver_ref_id: string | null;

  @ManyToOne(() => Driver, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'driver_ref_id' })
  driver_ref: Driver | null;

  @Column({ type: 'uuid', nullable: true })
  transporter_company_id: string | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transporter_company_id' })
  transporter_company_ref: Company | null;

  @Column({ type: 'uuid', nullable: true })
  booking_category_id: string | null;

  @ManyToOne(() => BookingCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'booking_category_id' })
  booking_category_ref: BookingCategory | null;

  /** EPT only. */
  @Column({ type: 'varchar', nullable: true })
  export_type: string | null;

  /** EPT only. */
  @Column({ type: 'varchar', nullable: true })
  ept_operation_type: string | null;

  /** Fish & EPT — free-text GatePass number, optionally matched to a Tep. */
  @Column({ type: 'varchar', nullable: true })
  gate_pass_number: string | null;

  @Column({ type: 'uuid', nullable: true })
  tep_id: string | null;

  @ManyToOne(() => Tep, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tep_id' })
  tep: Tep | null;

  @Column({ type: 'date', nullable: true })
  expected_arrival_date: string | null;

  /** Bonded Terminal / Truck Park / Fish. */
  @Column({ type: 'uuid', nullable: true })
  expected_arrival_time_slot_id: string | null;

  @ManyToOne(() => FacilityTimeslot, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'expected_arrival_time_slot_id' })
  expected_arrival_time_slot: FacilityTimeslot | null;

  /** EPT digital-clock arrival time. */
  @Column({ type: 'time', nullable: true })
  expected_arrival_time: string | null;

  /**
   * Priority tiers per the Prioritization of Bookings doc: Fish & Export
   * bookings are topmost (rank 1 / HIGH), Port Terminal destinations are
   * rank 2, Non-Port Terminal destinations are rank 3 (both MEDIUM).
   * Utility-ticket tiers (4/5) live on UtilityTicket.booking_priority, not
   * here.
   */
  @Column({ default: 'MEDIUM' })
  priority_level: string;

  @Column({ type: 'smallint', default: 3 })
  priority_rank: number;

  /**
   * Truck matched to a TEP/slot for this booking — set after in_facility_at
   * (a truck must check in before it can be matched). FIFO tiebreak #2.
   */
  @Column({ type: 'timestamp', nullable: true })
  matched_at: Date | null;

  /** Truck physically checked in at the facility — FIFO tiebreak #1. */
  @Column({ type: 'timestamp', nullable: true })
  in_facility_at: Date | null;

  /** Truck entered a Pregate transit park — cross-pregate FIFO tiebreak. */
  @Column({ type: 'timestamp', nullable: true })
  in_pregate_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  gtg_facility_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  gtg_pregate_at: Date | null;

  @Column({ default: 'PENDING' })
  payment_status: string;

  @Column({ type: 'varchar', nullable: true })
  payment_method: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  booking_fee: string | null;

  @Column({ type: 'timestamp', nullable: true })
  terms_accepted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  /** SuperAdmin who created this booking on behalf of the transporter. */
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User | null;

  @OneToMany(() => BookingTimelineEntry, (entry) => entry.booking)
  timeline: BookingTimelineEntry[];

  @OneToMany(() => BookingException, (exception) => exception.booking)
  exceptions: BookingException[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  last_updated_at: Date;
}

/** Timeline entry of a booking's lifecycle events. */
@Entity('booking_timeline_entries')
export class BookingTimelineEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  booking_id: string;

  @ManyToOne(() => Booking, (booking) => booking.timeline, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column()
  status: string;

  @Column({ type: 'varchar', nullable: true })
  performed_by: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}

/** Penalties, delays and exceptions recorded against a booking. */
@Entity('booking_exceptions')
@Check(
  'CHK_booking_exceptions_type',
  `"type" IN ('PENALTY', 'DELAY', 'EXCEPTION')`,
)
export class BookingException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  booking_id: string;

  @ManyToOne(() => Booking, (booking) => booking.exceptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column()
  type: string;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn()
  created_at: Date;
}
