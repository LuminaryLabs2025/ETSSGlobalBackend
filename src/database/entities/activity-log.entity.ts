import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ActivityLogEntryStatus } from '../../common/enums';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  user_id: string;

  @Column()
  action: string;

  @Column()
  entity: string;

  @Column({ nullable: true })
  entity_id: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  ip_address: string;

  /** Browser / client User-Agent when available. */
  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  /** Product area for dashboard columns (e.g. User Management). */
  @Column({ name: 'module', type: 'varchar', nullable: true })
  feature_module: string | null;

  /** Human-readable action (e.g. Disable user, User login). */
  @Column({ type: 'text', nullable: true })
  action_label: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ActivityLogEntryStatus.SUCCESS,
  })
  entry_status: ActivityLogEntryStatus;

  @Column({ type: 'int', nullable: true })
  http_status_code: number | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @ManyToOne(() => User, (user) => user.activity_logs, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  timestamp: Date;
}
