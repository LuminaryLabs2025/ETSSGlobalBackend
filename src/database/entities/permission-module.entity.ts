import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Permission } from './permission.entity';

@Entity('permission_modules')
export class PermissionModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable key for seeds and APIs (e.g. `bookings`). */
  @Column({ unique: true })
  key: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  /**
   * Sidebar section label key: `operations`, `infrastructure`, `administration`.
   * Null = top-level nav (Overview, Traffic Command, e-Revenue, etc.).
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  nav_section: string | null;

  @OneToMany(() => Permission, (p) => p.module)
  permissions: Permission[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
