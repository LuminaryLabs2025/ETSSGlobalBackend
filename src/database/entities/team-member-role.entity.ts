import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { TeamMember } from './team-member.entity';
import { Role } from './role.entity';

@Entity('team_member_roles')
@Unique(['team_member_id', 'role_id'])
export class TeamMemberRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  team_member_id: string;

  @Column()
  role_id: string;

  @ManyToOne(() => TeamMember, (tm) => tm.team_member_roles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'team_member_id' })
  team_member: TeamMember;

  @ManyToOne(() => Role, (role) => role.team_member_roles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @CreateDateColumn()
  created_at: Date;
}
