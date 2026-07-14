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
 * Master list of infraction categories / penalty definitions and their fine
 * amounts (Issued Fines - "All Penalties & Fines" tab). Codes auto-generate as
 * PEN-001. Status lifecycle: ACTIVE -> INACTIVE, plus ARCHIVED (SuperAdmin only).
 */
@Entity('penalty_definitions')
@Unique('UQ_penalty_definitions_penalty_code', ['penalty_code'])
@Check(
  'CHK_penalty_definitions_status',
  `"status" IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')`,
)
export class PenaltyDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  penalty_code: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  fine_amount: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  created_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  updated_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * Fines issued to Trucks and Drivers on a trip (Compliance | Infractions).
 * Booking and transporter details are stored as snapshots so the record is
 * self-contained regardless of downstream booking mutations.
 */
@Entity('issued_fines')
@Unique('UQ_issued_fines_issued_fine_id', ['issued_fine_id'])
@Check('CHK_issued_fines_status', `"status" IN ('ACCEPTED', 'DISPUTED')`)
@Check(
  'CHK_issued_fines_booking_category',
  `"booking_category" IN ('IMPORT', 'EXPORT', 'EMPTY')`,
)
export class IssuedFine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  issued_fine_id: string;

  @Column()
  penalty_code: string;

  @Column()
  penalty_name: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  fine_amount: string;

  // ── Booking snapshot ──
  @Column()
  booking_reference: string;

  @Column()
  terminal_destination: string;

  @Column({ type: 'timestamp' })
  booking_date: Date;

  @Column()
  booking_category: string;

  @Column()
  truck_booking_status: string;

  @Column()
  truck_plate_number: string;

  @Column()
  driver_name: string;

  // ── Transporter snapshot ──
  @Column()
  transporter_company_name: string;

  @Column({ type: 'varchar', nullable: true })
  transporter_user_account: string | null;

  @Column({ type: 'varchar', nullable: true })
  transporter_contact_person: string | null;

  @Column({ type: 'varchar', nullable: true })
  transporter_contact_number: string | null;

  @Column({ type: 'varchar', nullable: true })
  transporter_email: string | null;

  @Column({ type: 'timestamp' })
  date_issued: Date;

  @Column()
  issued_by: string;

  @Column({ default: 'ACCEPTED' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * Fine disputes raised by transporters against issued fines (Manage Fine
 * Disputes). Resolution is driven by SuperAdmins in coordination with the NPA.
 */
@Entity('fine_disputes')
@Unique('UQ_fine_disputes_dispute_id', ['dispute_id'])
@Check(
  'CHK_fine_disputes_status',
  `"dispute_status" IN ('PENDING_REVIEW', 'UNDER_NPA_REVIEW', 'RESOLVED', 'REJECTED')`,
)
@Check(
  'CHK_fine_disputes_resolution_outcome',
  `"resolution_outcome" IS NULL OR "resolution_outcome" IN ('FINE_UPHELD', 'FINE_WAIVED', 'FINE_ADJUSTED')`,
)
@Check(
  'CHK_fine_disputes_booking_category',
  `"booking_category" IN ('IMPORT', 'EXPORT', 'EMPTY')`,
)
export class FineDispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  dispute_id: string;

  @Column()
  issued_fine_id: string;

  @Column()
  penalty_code: string;

  @Column()
  penalty_name: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  fine_amount: string;

  // ── Booking snapshot ──
  @Column()
  booking_reference: string;

  @Column()
  terminal_destination: string;

  @Column({ type: 'timestamp' })
  booking_date: Date;

  @Column()
  booking_category: string;

  @Column()
  truck_booking_status: string;

  @Column()
  truck_plate_number: string;

  @Column()
  driver_name: string;

  // ── Transporter snapshot ──
  @Column()
  transporter_company_name: string;

  @Column({ type: 'varchar', nullable: true })
  transporter_user_account: string | null;

  @Column({ type: 'varchar', nullable: true })
  transporter_contact_person: string | null;

  @Column({ type: 'varchar', nullable: true })
  transporter_contact_number: string | null;

  @Column({ type: 'varchar', nullable: true })
  transporter_email: string | null;

  @Column({ type: 'timestamp' })
  date_issued: Date;

  @Column({ type: 'timestamp' })
  date_disputed: Date;

  @Column({ type: 'text' })
  dispute_reason: string;

  @Column({ default: 'PENDING_REVIEW' })
  dispute_status: string;

  @Column({ type: 'varchar', nullable: true })
  resolution_outcome: string | null;

  @Column({ type: 'varchar', nullable: true })
  managed_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resolution_date: Date | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  adjusted_amount: string | null;

  @OneToMany(() => FineDisputeEvent, (event) => event.dispute)
  resolution_history: FineDisputeEvent[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/** Audit trail of a fine dispute (rendered as resolution_history on the UI). */
@Entity('fine_dispute_events')
export class FineDisputeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  dispute_id: string;

  @ManyToOne(() => FineDispute, (dispute) => dispute.resolution_history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'dispute_id' })
  dispute: FineDispute;

  @Column()
  action: string;

  @Column()
  performed_by: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}
