import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Barrier } from './app-options.entities';
import { Booking } from './bookings.entities';
import { User } from './user.entity';

/**
 * Append-only log of trucks tagged (RFID / ANPR / handheld scan) at a
 * barrier. Powers "# of trucks tagged per hour", location ATAT and
 * occupancy on the Traffic Command live-location map, and auto-advances
 * the booking lifecycle stages that have no manual trigger (left-facility,
 * left-pregate, in-terminal). site_type/site_id/barrier_role are copied
 * from the BarrierSiteLink the tag was resolved against.
 */
@Entity('barrier_tag_events')
@Check(
  'CHK_barrier_tag_events_site_type',
  `"site_type" IN ('FACILITY', 'TRANSIT_PARK', 'TERMINAL')`,
)
@Check(
  'CHK_barrier_tag_events_barrier_role',
  `"barrier_role" IN ('ENTRY', 'EXIT')`,
)
@Check(
  'CHK_barrier_tag_events_source',
  `"source" IN ('BARRIER', 'HANDHELD', 'MANUAL')`,
)
@Index('IDX_barrier_tag_events_site_tagged_at', [
  'site_type',
  'site_id',
  'tagged_at',
])
@Index('IDX_barrier_tag_events_plate_site', [
  'truck_plate_number',
  'site_type',
  'site_id',
  'tagged_at',
])
@Index('IDX_barrier_tag_events_barrier_tagged_at', ['barrier_id', 'tagged_at'])
export class BarrierTagEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  barrier_id: string;

  @ManyToOne(() => Barrier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'barrier_id' })
  barrier: Barrier;

  @Column()
  site_type: string;

  @Column({ type: 'uuid' })
  site_id: string;

  @Column()
  barrier_role: string;

  @Column({ type: 'uuid', nullable: true })
  truck_id: string | null;

  @Column()
  truck_plate_number: string;

  @Column({ type: 'varchar', nullable: true })
  rfid_tag_number: string | null;

  /** LIVE booking the tag was matched to (if any). */
  @Column({ type: 'uuid', nullable: true })
  booking_id: string | null;

  @ManyToOne(() => Booking, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking | null;

  /** Booking stage this tag advanced, e.g. LEFT_FACILITY / LEFT_PREGATE / IN_TERMINAL. */
  @Column({ type: 'varchar', nullable: true })
  booking_transition: string | null;

  @Column({ default: 'BARRIER' })
  source: string;

  @Column({ type: 'timestamp' })
  tagged_at: Date;

  @Column({ type: 'uuid', nullable: true })
  recorded_by: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recorded_by' })
  recorded_by_user: User | null;

  @CreateDateColumn()
  created_at: Date;
}
