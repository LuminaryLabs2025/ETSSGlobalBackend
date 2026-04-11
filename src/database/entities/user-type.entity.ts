import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserTypeCategory } from '../../common/enums';
import { User } from './user.entity';

export interface UserTypeFieldOption {
  label: string;
  value: string;
}

export interface UserTypeField {
  /** API / JSON key in `extra_fields` — snake_case, same as request DTOs and DB style */
  name: string;
  label: string;
  type:
    | 'string'
    | 'number'
    | 'email'
    | 'phone'
    | 'select'
    | 'multi-select'
    | 'text'
    | 'file';
  required: boolean;
  options?: UserTypeFieldOption[];
  /**
   * When set, `options` may be empty: the client loads choices from the app
   * (e.g. companies created for another user type). Convention is a stable
   * string key your frontend/API agree on, e.g. `port_terminal_companies`.
   */
  optionsSource?: string;
  placeholder?: string;
  autoPopulated?: boolean;
  autoPopulatedValue?: string;
}

export interface UserTypeMetadata {
  fields: UserTypeField[];
}

@Entity('user_types')
export class UserType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  slug: string;

  @Column({ type: 'enum', enum: UserTypeCategory })
  category: UserTypeCategory;

  @Column({ type: 'jsonb', nullable: true })
  metadata: UserTypeMetadata | null;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => User, (user) => user.user_type)
  users: User[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
