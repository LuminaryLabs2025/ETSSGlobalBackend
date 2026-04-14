import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('notification_settings')
export class NotificationSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  user_id: string;

  @OneToOne(() => User, (user) => user.notification_settings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ default: true })
  email_notifications: boolean;

  @Column({ default: false })
  sms_notifications: boolean;

  @Column({ default: false })
  push_notifications: boolean;

  @UpdateDateColumn()
  updated_at: Date;
}
