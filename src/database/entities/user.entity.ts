import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { UserType } from './user-type.entity';
import { UserPermission } from './user-permission.entity';
import { TeamMember } from './team-member.entity';
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

  @Column()
  @Exclude()
  password: string;

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

  /** String form avoids circular import with `activity-log.entity` at load time. */
  @OneToMany('ActivityLog', 'user')
  activity_logs: ActivityLog[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
