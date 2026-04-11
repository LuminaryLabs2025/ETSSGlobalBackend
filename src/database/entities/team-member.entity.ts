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
import { User } from './user.entity';
import { TeamMemberRole } from './team-member-role.entity';
import { Exclude } from 'class-transformer';

@Entity('team_members')
export class TeamMember {
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

  @Column({ default: true })
  is_active: boolean;

  @Column()
  company_id: string;

  @ManyToOne(() => Company, (company) => company.team_members)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column()
  created_by: string;

  @ManyToOne(() => User, (user) => user.created_team_members)
  @JoinColumn({ name: 'created_by' })
  created_by_user: User;

  @OneToMany(
    () => TeamMemberRole,
    (teamMemberRole) => teamMemberRole.team_member,
  )
  team_member_roles: TeamMemberRole[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
