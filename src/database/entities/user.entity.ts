import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { UserType } from './user-type.entity';
import { UserPermission } from './user-permission.entity';
import { TeamMember } from './team-member.entity';
import { NotificationSettings } from './notification-settings.entity';
import type { ActivityLog } from './activity-log.entity';
import { Exclude } from 'class-transformer';
import { AccountType, UserStatus } from '../../common/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column()
  @Exclude()
  password: string;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  password_reset_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  password_reset_expires_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  invite_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  invite_token_expires_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  invite_token_used_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  password_changed_at: Date | null;

  @Column({ default: false })
  two_factor_enabled: boolean;

  @Column({ type: 'text', nullable: true })
  @Exclude()
  two_factor_secret: string | null;

  @Column({ default: false })
  is_super_admin: boolean;

  @Column({ type: 'enum', enum: AccountType, default: AccountType.SYSTEM })
  account_type: AccountType;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.AWAITING_ACTIVATION,
  })
  status: UserStatus;

  @Column({ nullable: true })
  user_type_id: string | null;

  @ManyToOne(() => UserType, (ut) => ut.users, { nullable: true })
  @JoinColumn({ name: 'user_type_id' })
  user_type: UserType;

  @Column({ nullable: true })
  company_id: string | null;

  @ManyToOne(() => Company, (company) => company.users, { nullable: true })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'jsonb', nullable: true })
  extra_fields: Record<string, any>;

  @Column({ nullable: true })
  invited_by: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'invited_by' })
  invited_by_user: User;

  @OneToMany(() => UserPermission, (up) => up.user)
  user_permissions: UserPermission[];

  @OneToMany(() => TeamMember, (teamMember) => teamMember.created_by_user)
  created_team_members: TeamMember[];

  @OneToOne(
    () => NotificationSettings,
    (notificationSettings) => notificationSettings.user,
  )
  notification_settings: NotificationSettings;

  /** String form avoids circular import with `activity-log.entity` at load time. */
  @OneToMany('ActivityLog', 'user')
  activity_logs: ActivityLog[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
