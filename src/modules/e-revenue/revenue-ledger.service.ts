import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  Booking,
  Invoice,
  PaymentTransaction,
  PaymentType,
  RevenueTransaction,
  User,
} from '../../database/entities';
import {
  PaymentTransactionObserver,
  PaymentsService,
} from '../payments/payments.service';
import {
  FeeBreakdownLine,
  RevenueSplit,
} from '../../database/entities/payments.entities';
import {
  PAYABLE_TYPE_TO_SOURCE,
  PaymentSource,
  paymentMethodFromChannel,
  paymentTypeSplit,
} from './e-revenue.constants';

const RECIPIENTS = [
  'facility',
  'transit_park',
  'npa',
  'tow_company',
] as const satisfies readonly (keyof RevenueSplit)[];
const ETSS_ONLY: RevenueSplit = {
  facility: 0,
  transit_park: 0,
  npa: 0,
  etss: 100,
  tow_company: 0,
};

const TID_SEQUENCE = 'revenue_transaction_tid_seq';

/** What a payment is for and who earns from it — resolved per payable type. */
interface RevenueContext {
  service_reference: string | null;
  payer_type: string | null;
  payer_company_id: string | null;
  payer_company_name: string | null;
  payer_user_id: string | null;
  facility: { id: string; name: string } | null;
  transit_park: { id: string; name: string } | null;
  tow_company: { id: string; name: string } | null;
  truck_plate_number: string | null;
  terminal_name: string | null;
}

export type LedgerRecordResult = 'created' | 'updated' | 'skipped';

/**
 * Maintains the e-Revenue ledger (`revenue_transactions`). Registered as a
 * PaymentsService transaction observer, so every gateway attempt is mirrored
 * in the same DB transaction as its status change. Shares are computed per
 * invoice fee line from the split snapshotted from its PaymentType (the
 * e-Revenue fee schedule), re-computed while the attempt is PENDING/FAILED,
 * and frozen once SUCCESSFUL.
 */
@Injectable()
export class RevenueLedgerService
  implements OnModuleInit, PaymentTransactionObserver
{
  private readonly logger = new Logger(RevenueLedgerService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly paymentsService: PaymentsService,
  ) {}

  async onModuleInit() {
    this.paymentsService.registerTransactionObserver(this);
    // A sequence (not MAX()+1) so concurrent payments never collide on the
    // public TID. Created here rather than in the migration so it also
    // exists on `synchronize` dev databases.
    await this.dataSource.query(
      `CREATE SEQUENCE IF NOT EXISTS "${TID_SEQUENCE}"`,
    );
  }

  async onTransactionChanged(params: {
    manager: EntityManager;
    invoice: Invoice;
    transaction: PaymentTransaction;
  }): Promise<void> {
    await this.record(params.manager, params.invoice, params.transaction);
  }

  async record(
    manager: EntityManager,
    invoice: Invoice,
    transaction: PaymentTransaction,
  ): Promise<LedgerRecordResult> {
    const source = PAYABLE_TYPE_TO_SOURCE[invoice.payable_type];
    if (!source) return 'skipped';

    const repo = manager.getRepository(RevenueTransaction);
    const existing = await repo.findOne({
      where: { payment_transaction_id: transaction.id },
    });
    if (existing?.status === 'SUCCESSFUL') return 'skipped';

    const context = await this.resolveContext(
      manager,
      source,
      invoice,
      transaction,
    );
    if (!context) return 'skipped';

    const amount = Number(transaction.amount);
    const split = await this.computeShares(manager, invoice, amount, context);
    const payerUserName = await this.userName(manager, context.payer_user_id);

    const row =
      existing ??
      repo.create({ transaction_id: await this.nextTransactionId(manager) });
    Object.assign(row, {
      payment_transaction_id: transaction.id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      payment_reference: transaction.reference,
      payment_source: source,
      payable_type: invoice.payable_type,
      payable_id: invoice.payable_id,
      service_reference: context.service_reference,
      payer_type: context.payer_type,
      payer_company_id: context.payer_company_id,
      payer_company_name: context.payer_company_name,
      payer_user_id: context.payer_user_id,
      payer_user_name: payerUserName,
      payer_email: transaction.customer_email,
      amount_paid: amount.toFixed(2),
      currency: transaction.currency,
      payment_method: paymentMethodFromChannel(transaction.channel),
      channel: transaction.channel,
      status: transaction.status,
      gateway_response: transaction.gateway_response,
      paid_at: transaction.paid_at,
      transacted_at: transaction.paid_at ?? transaction.created_at,
      facility_id: context.facility?.id ?? null,
      facility_name: context.facility?.name ?? null,
      transit_park_id: context.transit_park?.id ?? null,
      transit_park_name: context.transit_park?.name ?? null,
      tow_company_id: context.tow_company?.id ?? null,
      tow_company_name: context.tow_company?.name ?? null,
      truck_plate_number: context.truck_plate_number,
      terminal_name: context.terminal_name,
      ...split,
    });
    await repo.save(row);
    return existing ? 'updated' : 'created';
  }

  /**
   * Backfills/refreshes the ledger from every PaymentTransaction (e.g. after
   * deploying this module, or to repair a row an observer failure skipped).
   * SUCCESSFUL ledger rows are never rewritten.
   */
  async syncAll(): Promise<
    Record<LedgerRecordResult, number> & { scanned: number }
  > {
    const totals = { scanned: 0, created: 0, updated: 0, skipped: 0 };
    const batchSize = 200;
    let offset = 0;
    for (;;) {
      const batch = await this.dataSource
        .getRepository(PaymentTransaction)
        .createQueryBuilder('t')
        .innerJoinAndSelect('t.invoice', 'invoice')
        .orderBy('t.created_at', 'ASC')
        .addOrderBy('t.id', 'ASC')
        .skip(offset)
        .take(batchSize)
        .getMany();
      if (!batch.length) break;
      for (const transaction of batch) {
        totals.scanned += 1;
        try {
          const result = await this.dataSource.transaction((manager) =>
            this.record(manager, transaction.invoice, transaction),
          );
          totals[result] += 1;
        } catch (error) {
          totals.skipped += 1;
          this.logger.error(
            `Ledger sync failed for ${transaction.reference}`,
            error as Error,
          );
        }
      }
      offset += batch.length;
    }
    return totals;
  }

  // ─────────────────────────────────────────────────────────────────────

  /**
   * Splits each invoice fee line by its own recipient %, e.g. a Bonded
   * Terminal booking of Facility Bay 5,000 (100% facility) + Matching Fee
   * 10,000 (40% NPA / 60% ETSS) → facility 5,000, NPA 4,000, ETSS 6,000.
   * A recipient the payment doesn't relate to (no facility on an EPT
   * booking, no tow company yet…) falls back to Maritime-ETSS, as does any
   * amount not covered by fee lines. Lines from invoices raised before the
   * fee schedule had splits use their PaymentType's current split.
   */
  private async computeShares(
    manager: EntityManager,
    invoice: Invoice,
    amount: number,
    context: RevenueContext,
  ) {
    const lines: FeeBreakdownLine[] = [...(invoice.fee_breakdown ?? [])];
    const covered = lines.reduce((acc, l) => acc + Number(l.amount), 0);
    const uncovered = Math.round((amount - covered) * 100) / 100;
    if (uncovered > 0) {
      lines.push({ name: 'Unallocated', amount: uncovered, split: ETSS_ONLY });
    }

    const present: Record<(typeof RECIPIENTS)[number], boolean> = {
      facility: Boolean(context.facility),
      transit_park: Boolean(context.transit_park),
      npa: true,
      tow_company: Boolean(context.tow_company),
    };
    const totals: RevenueSplit = { ...ETSS_ONLY, etss: 0 };
    const feeLines: Record<string, unknown>[] = [];
    for (const line of lines) {
      const lineAmount = Number(line.amount);
      const split = line.split ?? (await this.currentSplit(manager, line));
      const shares: RevenueSplit = { ...ETSS_ONLY, etss: 0 };
      for (const recipient of RECIPIENTS) {
        // Kobo-rounded; Maritime-ETSS takes the exact remainder so the
        // shares always add back up to the line amount.
        shares[recipient] = present[recipient]
          ? Math.round(lineAmount * Number(split[recipient] ?? 0)) / 100
          : 0;
      }
      shares.etss =
        Math.round(
          (lineAmount - RECIPIENTS.reduce((acc, r) => acc + shares[r], 0)) *
            100,
        ) / 100;
      for (const key of Object.keys(totals) as (keyof RevenueSplit)[]) {
        totals[key] += shares[key];
      }
      feeLines.push({
        name: line.name,
        service_name: line.service_name ?? null,
        payment_type_id: line.payment_type_id ?? null,
        amount: lineAmount,
        split,
        shares,
      });
    }

    const pct = (value: number) =>
      amount ? Math.round((value / amount) * 10_000) / 100 : 0;
    return {
      facility_share: totals.facility.toFixed(2),
      transit_park_share: totals.transit_park.toFixed(2),
      npa_share: totals.npa.toFixed(2),
      tow_company_share: totals.tow_company.toFixed(2),
      etss_share: totals.etss.toFixed(2),
      share_percentages: {
        facility: pct(totals.facility),
        transit_park: pct(totals.transit_park),
        npa: pct(totals.npa),
        etss: pct(totals.etss),
        tow_company: pct(totals.tow_company),
      },
      fee_lines: feeLines,
    };
  }

  private async currentSplit(
    manager: EntityManager,
    line: FeeBreakdownLine,
  ): Promise<RevenueSplit> {
    const paymentType = await manager.getRepository(PaymentType).findOne({
      where: line.payment_type_id
        ? { id: line.payment_type_id }
        : { name: line.name },
    });
    return paymentType ? paymentTypeSplit(paymentType) : ETSS_ONLY;
  }

  private async resolveContext(
    manager: EntityManager,
    source: PaymentSource,
    invoice: Invoice,
    transaction: PaymentTransaction,
  ): Promise<RevenueContext | null> {
    switch (source) {
      case 'BOOKING':
        return this.resolveBookingContext(manager, invoice, transaction);
      default:
        // Utility tickets, penalties, tow requests and demurrage don't
        // raise invoices yet — add their resolvers alongside their payment flows.
        this.logger.warn(
          `No e-Revenue context resolver for payment source ${source}`,
        );
        return null;
    }
  }

  private async resolveBookingContext(
    manager: EntityManager,
    invoice: Invoice,
    transaction: PaymentTransaction,
  ): Promise<RevenueContext | null> {
    const booking = await manager.getRepository(Booking).findOne({
      where: { id: invoice.payable_id },
      relations: [
        'facility',
        'transit_park',
        'transporter_company_ref',
        'transporter_company_ref.user_type',
      ],
    });
    if (!booking) return null;
    const company = booking.transporter_company_ref;
    return {
      service_reference: booking.booking_id,
      payer_type: company?.user_type?.name ?? 'Transporter',
      payer_company_id: company?.id ?? null,
      payer_company_name: company?.name ?? booking.transporter_company ?? null,
      payer_user_id: transaction.initiated_by ?? booking.created_by ?? null,
      facility: booking.facility
        ? { id: booking.facility.id, name: booking.facility.name }
        : null,
      transit_park: booking.transit_park
        ? { id: booking.transit_park.id, name: booking.transit_park.name }
        : null,
      tow_company: null,
      truck_plate_number: booking.truck_plate_number,
      terminal_name: booking.terminal_name,
    };
  }

  private async userName(
    manager: EntityManager,
    userId: string | null,
  ): Promise<string | null> {
    if (!userId) return null;
    const user = await manager.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'first_name', 'last_name'],
    });
    return user ? `${user.first_name} ${user.last_name}`.trim() : null;
  }

  private async nextTransactionId(manager: EntityManager): Promise<string> {
    const [row] = await manager.query<{ next: string }[]>(
      `SELECT nextval('"${TID_SEQUENCE}"') AS next`,
    );
    return `TID-${String(row.next).padStart(7, '0')}`;
  }
}
