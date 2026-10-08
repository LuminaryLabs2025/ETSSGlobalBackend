import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Invoice, PaymentTransaction } from './payments.entities';

/**
 * e-Revenue ledger — one row per gateway PaymentTransaction, upserted by
 * RevenueLedgerService whenever PaymentsService changes a transaction's
 * status. Snapshots the payer, the linked service (booking etc.) and each
 * recipient's share — computed per invoice fee line from that line's
 * PaymentType split — so later price/split edits or renames never rewrite
 * historical revenue. Shares are frozen once the row is SUCCESSFUL.
 */
@Entity('revenue_transactions')
@Unique('UQ_revenue_transactions_transaction_id', ['transaction_id'])
@Unique('UQ_revenue_transactions_payment_transaction_id', [
  'payment_transaction_id',
])
@Check(
  'CHK_revenue_transactions_payment_source',
  `"payment_source" IN ('BOOKING', 'UTILITY_TICKET', 'PENALTY', 'TOW_TRUCK_REQUEST', 'DEMURRAGE')`,
)
@Check(
  'CHK_revenue_transactions_status',
  `"status" IN ('PENDING', 'SUCCESSFUL', 'FAILED', 'ABANDONED')`,
)
@Index('IDX_revenue_transactions_transacted_at', ['transacted_at'])
@Index('IDX_revenue_transactions_source_status', ['payment_source', 'status'])
@Index('IDX_revenue_transactions_facility_id', ['facility_id'])
@Index('IDX_revenue_transactions_transit_park_id', ['transit_park_id'])
@Index('IDX_revenue_transactions_tow_company_id', ['tow_company_id'])
export class RevenueTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Public ledger id, e.g. TID-0000001. */
  @Column()
  transaction_id: string;

  @Column({ type: 'uuid' })
  payment_transaction_id: string;

  @ManyToOne(() => PaymentTransaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_transaction_id' })
  payment_transaction: PaymentTransaction;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'varchar', nullable: true })
  invoice_number: string | null;

  /** Gateway reference (Paystack), e.g. MTMS-1712345678-ab12cd34. */
  @Column()
  payment_reference: string;

  @Column()
  payment_source: string;

  @Column()
  payable_type: string;

  @Column({ type: 'uuid' })
  payable_id: string;

  /** Human reference of the linked service, e.g. the booking's BKG-2026-000001. */
  @Column({ type: 'varchar', nullable: true })
  service_reference: string | null;

  // ── Payer snapshot ──
  /** Payer's user type label, e.g. "Transporter". */
  @Column({ type: 'varchar', nullable: true })
  payer_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  payer_company_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  payer_company_name: string | null;

  @Column({ type: 'uuid', nullable: true })
  payer_user_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  payer_user_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  payer_email: string | null;

  // ── Money ──
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount_paid: string;

  @Column({ default: 'NGN' })
  currency: string;

  /** CARD | BANK_TRANSFER | USSD | WALLET | PAYSTACK (channel not yet known). */
  @Column()
  payment_method: string;

  @Column({ type: 'varchar', nullable: true })
  channel: string | null;

  @Column()
  status: string;

  @Column({ type: 'text', nullable: true })
  gateway_response: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  /** paid_at, or when the attempt was created if it never succeeded — the date filters/sorts use this. */
  @Column({ type: 'timestamp' })
  transacted_at: Date;

  // ── Beneficiaries & shares ──
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  etss_share: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  npa_share: string;

  @Column({ type: 'uuid', nullable: true })
  facility_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  facility_name: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  facility_share: string;

  @Column({ type: 'uuid', nullable: true })
  transit_park_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  transit_park_name: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  transit_park_share: string;

  @Column({ type: 'uuid', nullable: true })
  tow_company_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  tow_company_name: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  tow_company_share: string;

  /** Effective % of amount_paid per recipient, as `{facility, transit_park, npa, etss, tow_company}`. */
  @Column({ type: 'jsonb', nullable: true })
  share_percentages: Record<string, number> | null;

  /** Per fee line: `{name, service_name, payment_type_id, amount, split, shares}`. */
  @Column({ type: 'jsonb', nullable: true })
  fee_lines: Record<string, unknown>[] | null;

  @Column({ type: 'varchar', nullable: true })
  truck_plate_number: string | null;

  @Column({ type: 'varchar', nullable: true })
  terminal_name: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
