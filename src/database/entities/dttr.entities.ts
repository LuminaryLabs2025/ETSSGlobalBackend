import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Terminal } from './terminals-parks-facilities.entities';

/**
 * Daily Terminal Truck Request (DTTR) per terminal. Holds the current requested
 * breakdown by transfer type (exports/imports/empties/gatepass), the approved
 * daily capacity, and the request mode (MANUAL or AUTOMATED with a template).
 */
@Entity('dttr_terminal_requests')
@Unique('UQ_dttr_terminal_requests_terminal_code', ['terminal_code'])
@Check(
  'CHK_dttr_terminal_requests_mode',
  `"request_mode" IN ('MANUAL', 'AUTOMATED')`,
)
export class DttrTerminalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  terminal_id: string | null;

  @ManyToOne(() => Terminal, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'terminal_id' })
  terminal: Terminal | null;

  @Column()
  terminal_name: string;

  @Column()
  terminal_code: string;

  @Column({ type: 'integer' })
  approved_daily_capacity: number;

  @Column({ type: 'integer', default: 0 })
  req_exports: number;

  @Column({ type: 'integer', default: 0 })
  req_imports: number;

  @Column({ type: 'integer', default: 0 })
  req_empties: number;

  @Column({ type: 'integer', default: 0 })
  req_gatepass: number;

  @Column({ default: 'MANUAL' })
  request_mode: string;

  @Column({ type: 'integer', nullable: true })
  auto_exports: number | null;

  @Column({ type: 'integer', nullable: true })
  auto_imports: number | null;

  @Column({ type: 'integer', nullable: true })
  auto_empties: number | null;

  @Column({ type: 'integer', nullable: true })
  auto_gatepass: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_updated_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/** Historical record of a submitted daily truck request. */
@Entity('dttr_submissions')
export class DttrSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  terminal_request_id: string;

  @ManyToOne(() => DttrTerminalRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'terminal_request_id' })
  terminal_request: DttrTerminalRequest;

  @Column()
  terminal_name: string;

  @Column({ type: 'integer' })
  req_exports: number;

  @Column({ type: 'integer' })
  req_imports: number;

  @Column({ type: 'integer' })
  req_empties: number;

  @Column({ type: 'integer' })
  req_gatepass: number;

  @Column({ type: 'integer' })
  total_requested: number;

  @Column({ type: 'integer' })
  approved_capacity: number;

  @Column()
  request_mode: string;

  @Column()
  submitted_by: string;

  @Column({ type: 'varchar', nullable: true })
  submitted_by_id: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submitted_at: Date;
}

/** SuperAdmin edit audit for a terminal's daily request (requires approval). */
@Entity('dttr_edit_audits')
export class DttrEditAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  terminal_request_id: string;

  @ManyToOne(() => DttrTerminalRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'terminal_request_id' })
  terminal_request: DttrTerminalRequest;

  @Column()
  terminal_name: string;

  @Column({ type: 'jsonb' })
  edited_fields: string[];

  @Column()
  performed_by: string;

  @Column({ type: 'varchar', nullable: true })
  performed_by_id: string | null;

  @Column({ type: 'text' })
  justification: string;

  @Column({ type: 'varchar', nullable: true })
  approval_reference: string | null;

  @Column({ type: 'varchar', nullable: true })
  approval_document_name: string | null;

  @Column({ type: 'jsonb' })
  previous_values: Record<string, number>;

  @Column({ type: 'jsonb' })
  new_values: Record<string, number>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  edited_at: Date;
}
