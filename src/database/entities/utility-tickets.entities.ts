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
import { Terminal } from './terminals-parks-facilities.entities';

/**
 * Utility ticket requests raised by Terminals (Port and Non-Port), or generated
 * by a SuperAdmin on behalf of a terminal. Port terminals default to PRIORITY
 * booking classification; Non-Port terminals to STANDARD.
 */
@Entity('utility_tickets')
@Unique('UQ_utility_tickets_ticket_id', ['ticket_id'])
@Check('CHK_utility_tickets_terminal_type', `"terminal_type" IN ('PORT', 'NON_PORT')`)
@Check(
  'CHK_utility_tickets_status',
  `"status" IN ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')`,
)
@Check(
  'CHK_utility_tickets_request_type',
  `"request_type" IN ('POWER', 'WATER', 'MAINTENANCE', 'WASTE_MANAGEMENT', 'SECURITY', 'FUEL', 'OTHER')`,
)
@Check(
  'CHK_utility_tickets_priority',
  `"booking_priority" IN ('PRIORITY', 'STANDARD')`,
)
export class UtilityTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ticket_id: string;

  @Column({ type: 'uuid', nullable: true })
  terminal_id: string | null;

  @ManyToOne(() => Terminal, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'terminal_id' })
  terminal: Terminal | null;

  @Column()
  terminal_name: string;

  @Column({ type: 'varchar', nullable: true })
  terminal_code: string | null;

  @Column()
  terminal_type: string;

  @Column({ type: 'varchar', nullable: true })
  terminal_location: string | null;

  @Column()
  request_type: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  full_description: string;

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ default: 'STANDARD' })
  booking_priority: string;

  @Column()
  delivery_company_name: string;

  @Column({ type: 'varchar', nullable: true })
  truck_plate_number: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date_raised: Date;

  @Column({ type: 'varchar', nullable: true })
  raised_by_user_id: string | null;

  @Column()
  raised_by_user_name: string;

  @Column({ type: 'boolean', default: false })
  super_admin_approved: boolean;

  @Column({ type: 'varchar', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'boolean', default: false })
  e_ticket_available: boolean;

  @OneToMany(() => UtilityTicketHistory, (entry) => entry.ticket)
  request_history: UtilityTicketHistory[];

  @OneToMany(() => UtilityAssignedPersonnel, (person) => person.ticket)
  assigned_personnel: UtilityAssignedPersonnel[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  last_updated_at: Date;
}

/** Status history of a utility ticket. */
@Entity('utility_ticket_history')
@Check(
  'CHK_utility_ticket_history_status',
  `"status" IN ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')`,
)
export class UtilityTicketHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @ManyToOne(() => UtilityTicket, (ticket) => ticket.request_history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticket_id' })
  ticket: UtilityTicket;

  @Column()
  status: string;

  @Column()
  performed_by: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}

/** Personnel assigned to service a utility ticket. */
@Entity('utility_assigned_personnel')
export class UtilityAssignedPersonnel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @ManyToOne(() => UtilityTicket, (ticket) => ticket.assigned_personnel, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticket_id' })
  ticket: UtilityTicket;

  @Column()
  name: string;

  @Column()
  role: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  assigned_at: Date;
}
