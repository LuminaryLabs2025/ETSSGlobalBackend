import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * What's owed for a payable record in the system. `payable_type`/`payable_id`
 * is a soft polymorphic reference (same pattern as IssuedFine's denormalized
 * `booking_reference` snapshot elsewhere in this codebase) since Postgres
 * can't enforce a real FK across more than one possible target table. Only
 * `'BOOKING'` exists today, but the schema is generic so fines/utility-tickets
 * can adopt it later without a rework.
 */
@Entity('invoices')
@Unique('UQ_invoices_invoice_number', ['invoice_number'])
@Check('CHK_invoices_payable_type', `"payable_type" IN ('BOOKING')`)
@Check('CHK_invoices_status', `"status" IN ('PENDING', 'PAID', 'CANCELLED')`)
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  invoice_number: string;

  @Column()
  payable_type: string;

  @Index('IDX_invoices_payable_id')
  @Column({ type: 'uuid' })
  payable_id: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ default: 'NGN' })
  currency: string;

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Snapshot of the PaymentType lines that produced `amount`, so a later
   * catalog edit never retroactively changes a historical invoice.
   */
  @Column({ type: 'jsonb', nullable: true })
  fee_breakdown: { name: string; amount: number }[] | null;

  @Column({ type: 'uuid', nullable: true })
  issued_by: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'issued_by' })
  issued_by_user: User | null;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at: Date | null;

  @OneToMany(() => PaymentTransaction, (transaction) => transaction.invoice)
  transactions: PaymentTransaction[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * One gateway attempt to pay an Invoice. Named `PaymentTransaction` — not
 * bare "Transaction" — to avoid colliding with `dataSource.transaction(...)`
 * used throughout this codebase. At most one `PENDING` transaction may exist
 * per invoice at a time (enforced by the partial unique index below); this
 * is the DB-level idempotency guarantee for double-click/retry on initialize.
 */
@Entity('payment_transactions')
@Unique('UQ_payment_transactions_reference', ['reference'])
@Index('IDX_payment_transactions_invoice_pending', ['invoice_id'], {
  unique: true,
  where: `"status" = 'PENDING'`,
})
@Check('CHK_payment_transactions_gateway', `"gateway" IN ('PAYSTACK')`)
@Check(
  'CHK_payment_transactions_status',
  `"status" IN ('PENDING', 'SUCCESSFUL', 'FAILED', 'ABANDONED')`,
)
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reference: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ default: 'PAYSTACK' })
  gateway: string;

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @Column({ default: 'NGN' })
  currency: string;

  @Column({ type: 'varchar', nullable: true })
  customer_email: string | null;

  @Column({ type: 'text', nullable: true })
  paystack_authorization_url: string | null;

  @Column({ type: 'varchar', nullable: true })
  paystack_access_code: string | null;

  /** Populated from Paystack's `channel` field once the charge completes (card/bank/ussd/...). */
  @Column({ type: 'varchar', nullable: true })
  channel: string | null;

  @Column({ type: 'text', nullable: true })
  gateway_response: string | null;

  /** Full Paystack verify/webhook response snapshot, for audit/debugging. */
  @Column({ type: 'jsonb', nullable: true })
  raw_response: Record<string, unknown> | null;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  initiated_by: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'initiated_by' })
  initiated_by_user: User | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

/**
 * Append-only Paystack webhook log — audit/observability only. It is NOT the
 * idempotency boundary (that's the row lock in PaymentsService.finalizeTransaction);
 * every event, including invalid-signature and unknown-reference ones, is
 * logged here first.
 */
@Entity('payment_webhook_events')
export class PaymentWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'PAYSTACK' })
  provider: string;

  @Column()
  event_type: string;

  @Index('IDX_payment_webhook_events_reference')
  @Column({ type: 'varchar', nullable: true })
  reference: string | null;

  @Column({ default: false })
  signature_valid: boolean;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ default: false })
  processed: boolean;

  @Column({ type: 'text', nullable: true })
  processing_error: string | null;

  @CreateDateColumn()
  received_at: Date;
}
