import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Operations Command & Control order (dashboard overview). The overview
 * recommends a corridor intervention from rules over live congestion,
 * incidents and queues; a SuperAdmin authorises it, which records this row
 * and notifies LASTMA / Ops Control. The order stays ACTIVE until lifted.
 */
@Entity('ops_command_orders')
@Check(
  'CHK_ops_command_orders_action',
  `"action" IN ('SUSPEND_RED_ZONE_DISPATCH', 'REROUTE_CORRIDOR_TRAFFIC', 'ACTIVATE_OVERFLOW_HOLDING', 'BROADCAST_DIVERSION_ADVISORY', 'PRIORITY_MOVEMENT')`,
)
@Check('CHK_ops_command_orders_status', `"status" IN ('ACTIVE', 'LIFTED')`)
@Index('IDX_ops_command_orders_status_action', ['status', 'action'])
@Index('IDX_ops_command_orders_authorised_at', ['authorised_at'])
export class OpsCommandOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** OPS-YYYY-NNNNNN */
  @Column({ unique: true })
  reference_id: string;

  @Column()
  action: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  /** Sites / bookings the order applies to, e.g. red-zone sites or a priority convoy. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  targets: { type: string; id: string; name: string }[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Whether the rules engine recommended this action at authorisation time. */
  @Column({ type: 'boolean', default: false })
  was_recommended: boolean;

  @Column({ type: 'text', nullable: true })
  recommendation_reason: string | null;

  @Column({ type: 'int', nullable: true })
  congestion_index: number | null;

  @Column({ type: 'uuid' })
  authorised_by: string;

  @Column()
  authorised_by_name: string;

  @Column({ type: 'timestamp' })
  authorised_at: Date;

  /** Recipients the order notification was sent to (LASTMA / Ops Control). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  notified_recipients: string[];

  @Column({ type: 'timestamp', nullable: true })
  notified_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notification_error: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lifted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  lifted_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  lifted_by_name: string | null;

  @Column({ type: 'text', nullable: true })
  lift_reason: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
