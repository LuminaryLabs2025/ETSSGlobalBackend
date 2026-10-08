import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';
import { Booking } from './bookings.entities';
import { Truck, Driver } from './operations.entities';

export const INCIDENT_TYPES = [
  'TRUCK_BREAKDOWN',
  'CARGO_DAMAGE',
  'ACCIDENT_INJURY',
  'GATE_CONGESTION',
  'SECURITY_BREACH',
  'PAYMENT_DISPUTE',
  'SYSTEM_DOWNTIME',
] as const;

export const INCIDENT_SEVERITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export const INCIDENT_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'PENDING_SUPERADMIN_APPROVAL',
  'CLOSED',
  'REJECTED_BY_SUPERADMIN',
  'REOPENED',
] as const;

export const INCIDENT_LOCATION_KINDS = [
  'FACILITY',
  'TRANSIT_PARK',
  'PORT_TERMINAL',
] as const;

export const INCIDENT_ESCALATION_LEVELS = [
  'MANAGEMENT',
  'NPA',
  'EXECUTIVE',
] as const;

const inList = (values: readonly string[]) =>
  values.map((v) => `'${v}'`).join(', ');

/**
 * Incidents reported by PRIMARY account holders (MVP 090) and managed by
 * SuperAdmin: assignment to a company/user, severity, deadline, escalation,
 * evidence requests, emergency response and resolution approval. Location
 * and related truck/driver/booking are snapshotted so renames/deletes never
 * rewrite the report.
 */
@Entity('incidents')
@Unique('UQ_incidents_reference_id', ['reference_id'])
@Check('CHK_incidents_type', `"type" IN (${inList(INCIDENT_TYPES)})`)
@Check(
  'CHK_incidents_severity',
  `"severity" IN (${inList(INCIDENT_SEVERITIES)})`,
)
@Check('CHK_incidents_status', `"status" IN (${inList(INCIDENT_STATUSES)})`)
@Check(
  'CHK_incidents_location_kind',
  `"location_kind" IN (${inList(INCIDENT_LOCATION_KINDS)})`,
)
@Check(
  'CHK_incidents_escalation_level',
  `"escalation_level" IS NULL OR "escalation_level" IN (${inList(INCIDENT_ESCALATION_LEVELS)})`,
)
@Index('IDX_incidents_status', ['status'])
@Index('IDX_incidents_reporter_company_id', ['reporter_company_id'])
@Index('IDX_incidents_assigned_company_id', ['assigned_company_id'])
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** INC-2026-000001 */
  @Column()
  reference_id: string;

  @Column()
  type: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: 'MEDIUM' })
  severity: string;

  @Column({ default: 'OPEN' })
  status: string;

  // ── Location snapshot ──
  @Column()
  location_kind: string;

  /** Soft reference to facilities / transit_parks / terminals by kind. */
  @Column({ type: 'uuid', nullable: true })
  location_id: string | null;

  @Column()
  location_name: string;

  // ── Reporter (PRIMARY account holder) ──
  @Column({ type: 'uuid', nullable: true })
  reported_by: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reported_by' })
  reporter: User | null;

  @Column({ type: 'varchar', nullable: true })
  reporter_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  reporter_email: string | null;

  @Column({ type: 'uuid', nullable: true })
  reporter_company_id: string | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reporter_company_id' })
  reporter_company: Company | null;

  @Column({ type: 'varchar', nullable: true })
  reporter_company_name: string | null;

  @Column({ type: 'timestamp' })
  reported_at: Date;

  // ── Related entities (truck breakdowns only) ──
  @Column({ type: 'uuid', nullable: true })
  truck_id: string | null;

  @ManyToOne(() => Truck, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'truck_id' })
  truck: Truck | null;

  @Column({ type: 'varchar', nullable: true })
  truck_plate_number: string | null;

  @Column({ type: 'uuid', nullable: true })
  driver_ref_id: string | null;

  @ManyToOne(() => Driver, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'driver_ref_id' })
  driver: Driver | null;

  @Column({ type: 'varchar', nullable: true })
  driver_name: string | null;

  @Column({ type: 'uuid', nullable: true })
  booking_id: string | null;

  @ManyToOne(() => Booking, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking | null;

  @Column({ type: 'varchar', nullable: true })
  booking_reference: string | null;

  @Column({ type: 'varchar', nullable: true })
  payment_reference: string | null;

  // ── Assignment ──
  @Column({ type: 'uuid', nullable: true })
  assigned_company_id: string | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_company_id' })
  assigned_company: Company | null;

  @Column({ type: 'varchar', nullable: true })
  assigned_team_name: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_user_id: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_user_id' })
  assigned_user: User | null;

  @Column({ type: 'timestamp', nullable: true })
  assigned_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  priority_deadline: Date | null;

  // ── SuperAdmin interventions ──
  @Column({ type: 'varchar', nullable: true })
  escalation_level: string | null;

  @Column({ type: 'timestamp', nullable: true })
  escalated_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  evidence_requested_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  emergency_action: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emergency_triggered_at: Date | null;

  // ── Resolution ──
  @Column({ type: 'text', nullable: true })
  root_cause: string | null;

  @Column({ type: 'text', nullable: true })
  corrective_action: string | null;

  @Column({ type: 'text', nullable: true })
  resolution_notes: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resolution_submitted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  resolved_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resolved_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  closed_at: Date | null;

  /** Resolved on or before priority_deadline (null when no deadline was set). */
  @Column({ type: 'boolean', nullable: true })
  sla_met: boolean | null;

  @OneToMany(() => IncidentEvidence, (e) => e.incident)
  evidence: IncidentEvidence[];

  @OneToMany(() => IncidentEvent, (e) => e.incident)
  events: IncidentEvent[];

  @OneToMany(() => IncidentNote, (n) => n.incident)
  notes: IncidentNote[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('incident_evidence')
@Check('CHK_incident_evidence_type', `"type" IN ('PHOTO', 'FILE')`)
@Check('CHK_incident_evidence_phase', `"phase" IN ('REPORT', 'RESOLUTION')`)
@Index('IDX_incident_evidence_incident_id', ['incident_id'])
export class IncidentEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  incident_id: string;

  @ManyToOne(() => Incident, (i) => i.evidence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @Column()
  label: string;

  @Column({ default: 'FILE' })
  type: string;

  @Column({ type: 'text' })
  url: string;

  /** REPORT (with/after the report) | RESOLUTION (post-resolution proof). */
  @Column({ default: 'REPORT' })
  phase: string;

  @Column({ type: 'uuid', nullable: true })
  uploaded_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  uploaded_by_name: string | null;

  @CreateDateColumn()
  created_at: Date;
}

/**
 * Activity timeline. `is_action` marks SuperAdmin/assignee interventions
 * (assign, escalate, emergency response...) — the "actions already taken"
 * list is derived from these.
 */
@Entity('incident_events')
@Index('IDX_incident_events_incident_id', ['incident_id'])
export class IncidentEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  incident_id: string;

  @ManyToOne(() => Incident, (i) => i.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @Column()
  event_type: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @Column({ default: false })
  is_action: boolean;

  @Column({ type: 'uuid', nullable: true })
  actor_user_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  actor_name: string | null;

  @CreateDateColumn()
  created_at: Date;
}

@Entity('incident_notes')
@Check(
  'CHK_incident_notes_kind',
  `"kind" IN ('COMMENT', 'INSTRUCTION', 'REJECTION')`,
)
@Index('IDX_incident_notes_incident_id', ['incident_id'])
export class IncidentNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  incident_id: string;

  @ManyToOne(() => Incident, (i) => i.notes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @Column({ default: 'COMMENT' })
  kind: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'uuid', nullable: true })
  author_user_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  author_name: string | null;

  /** Author's company/team name (MARITIME-ETSS for SuperAdmin). */
  @Column({ type: 'varchar', nullable: true })
  team: string | null;

  @CreateDateColumn()
  created_at: Date;
}
