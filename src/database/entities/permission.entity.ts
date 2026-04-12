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
import { UserPermission } from './user-permission.entity';
import { UserTypePermission } from './user-type-permission.entity';
import { PermissionModule } from './permission-module.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Nullable so TypeORM `synchronize` can add the column on DBs that already have
   * permission rows; seeds always set this. Prefer running seed after first sync.
   */
  @Column({ nullable: true })
  module_id: string | null;

  @ManyToOne(() => PermissionModule, (m) => m.permissions, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'module_id' })
  module: PermissionModule | null;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @OneToMany(() => UserTypePermission, (utp) => utp.permission)
  user_type_permission_links: UserTypePermission[];

  @OneToMany(() => UserPermission, (up) => up.permission)
  user_permission_links: UserPermission[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
