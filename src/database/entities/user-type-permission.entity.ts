import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { UserType } from './user-type.entity';
import { Permission } from './permission.entity';

@Entity('user_type_permissions')
@Unique(['user_type_id', 'permission_id'])
export class UserTypePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_type_id: string;

  @Column()
  permission_id: string;

  @ManyToOne(() => UserType, (ut) => ut.user_type_permissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_type_id' })
  user_type: UserType;

  @ManyToOne(() => Permission, (p) => p.user_type_permission_links, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;

  @CreateDateColumn()
  created_at: Date;
}
