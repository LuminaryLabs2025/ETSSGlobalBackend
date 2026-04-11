import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { TeamMember } from './team-member.entity';
import { UserType } from './user-type.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  user_type_id: string;

  @ManyToOne(() => UserType, { nullable: true })
  @JoinColumn({ name: 'user_type_id' })
  user_type: UserType;

  @Column({ type: 'jsonb', nullable: true })
  extra_data: Record<string, any>;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => User, (user) => user.company)
  users: User[];

  @OneToMany(() => TeamMember, (teamMember) => teamMember.company)
  team_members: TeamMember[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
