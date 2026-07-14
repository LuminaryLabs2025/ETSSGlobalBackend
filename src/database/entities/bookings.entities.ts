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
