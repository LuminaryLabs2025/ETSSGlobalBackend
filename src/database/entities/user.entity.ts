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
import { UserRole } from './user-role.entity';
import { TeamMember } from './team-member.entity';
import { ActivityLog } from './activity-log.entity';
import { Exclude } from 'class-transformer';

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

  @Column()
  @Exclude()
  password: string;

  @Column({ default: false })
  is_super_admin: boolean;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  company_id: string;

  @ManyToOne(() => Company, (company) => company.users, { nullable: true })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  user_roles: UserRole[];

  @OneToMany(() => TeamMember, (teamMember) => teamMember.created_by_user)
  created_team_members: TeamMember[];

  @OneToMany(() => ActivityLog, (log) => log.user)
  activity_logs: ActivityLog[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
