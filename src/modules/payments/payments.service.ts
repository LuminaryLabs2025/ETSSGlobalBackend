import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Invoice,
  PaymentTransaction,
  PaymentWebhookEvent,
} from '../../database/entities';
import {
  nextSequentialCode,
  paginateQueryBuilder,
} from '../../common/utils/query-helpers';
import { PaystackClientService } from './paystack-client.service';
import { QueryPaymentsDto } from './dto/query-payments.dto';

/** Checkout links go stale well before this; treat as abandoned rather than reuse. */
const STALE_PENDING_MINUTES = 30;

export type PaymentFinalizeOutcome = 'PAID' | 'PAID_AFTER_CANCELLED' | 'FAILED';

/**
 * Registered by whichever module owns a `payable_type` (only 'BOOKING'
 * today) so PaymentsService can react to payment outcomes without importing
 * that module directly — avoids a circular BookingsModule <-> PaymentsModule
 * dependency while keeping the Invoice/Transaction schema genuinely generic.
 * All callbacks receive the transactional EntityManager so the payable's own
 * state update commits atomically with the Invoice/Transaction rows.
 */
export interface PayableSyncHandler {
  onPaymentFinalized(params: {
    manager: EntityManager;
    invoice: Invoice;
    transaction: PaymentTransaction;
    outcome: PaymentFinalizeOutcome;
  }): Promise<void>;
  onPayableEvent(params: {
    manager: EntityManager;
    payableId: string;
    eventLabel: string;
    notes?: string;
  }): Promise<void>;
}

export interface CreateInvoiceParams {
  payableType: string;
  payableId: string;
  amount: number;
  /**
   * Whether an ACTIVE PaymentType actually exists for this payable's
   * linked_form — NOT just "amount happens to be 0". An unconfigured fee
   * (no PaymentType rows at all) must never auto-settle, or every booking
   * of an unconfigured type would silently become free forever.
   */
  feeConfigured: boolean;
  currency?: string;
  description: string;
  feeBreakdown?: { name: string; amount: number }[];
  issuedByUserId?: string | null;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly payableHandlers = new Map<string, PayableSyncHandler>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(PaymentTransaction)
    private readonly transactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookEventRepository: Repository<PaymentWebhookEvent>,
    private readonly paystackClient: PaystackClientService,
  ) {}

  registerPayableSyncHandler(payableType: string, handler: PayableSyncHandler) {
    this.payableHandlers.set(payableType, handler);
  }

  get publicKey(): string {
    return this.paystackClient.publicKey;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Invoice creation (called synchronously by the owning module, e.g.
  // BookingsService.persistBooking)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Creates the Invoice for a payable. Only auto-settles (Invoice created
   * already PAID, no PaymentTransaction row — Paystack rejects amount=0
   * anyway) when `feeConfigured` is true AND `amount` is 0 — i.e. a
   * deliberately-configured ₦0 PaymentType (a promo/waiver). An
   * unconfigured fee (`feeConfigured: false`, amount defaults to 0) stays
   * PENDING — `initializePayment` is what rejects that case (422), not this
   * method, so an unconfigured booking type never silently becomes free.
   */
  async createInvoiceForPayable(
    params: CreateInvoiceParams,
  ): Promise<{ invoice: Invoice; autoSettled: boolean }> {
    const autoSettled = params.feeConfigured && params.amount <= 0;
    const invoice_number = await this.nextInvoiceNumber();
    const invoice = this.invoiceRepository.create({
      invoice_number,
      payable_type: params.payableType,
      payable_id: params.payableId,
      amount: params.amount.toFixed(2),
      currency: params.currency ?? 'NGN',
      status: autoSettled ? 'PAID' : 'PENDING',
      description: params.description,
      fee_breakdown: params.feeBreakdown ?? null,
      issued_by: params.issuedByUserId ?? null,
      paid_at: autoSettled ? new Date() : null,
    });
    const saved = await this.invoiceRepository.save(invoice);
    return { invoice: saved, autoSettled };
  }

  async getInvoiceForPayable(
    payableType: string,
    payableId: string,
  ): Promise<Invoice | null> {
    return this.invoiceRepository.findOne({
      where: { payable_type: payableType, payable_id: payableId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Cancels a still-PENDING invoice for a payable (no-op if already
   * PAID/CANCELLED or none exists) and abandons any active PENDING
   * transaction on it — so a stale Paystack checkout link can't later
   * succeed into a cancelled payable's invoice. Pass `manager` to run as
   * part of the caller's own DB transaction (e.g. BookingsService.cancelBooking).
   */
  async cancelInvoiceForPayable(
    payableType: string,
    payableId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const invoiceRepo = manager
      ? manager.getRepository(Invoice)
      : this.invoiceRepository;
    const txRepo = manager
      ? manager.getRepository(PaymentTransaction)
      : this.transactionRepository;

    const invoice = await invoiceRepo.findOne({
      where: {
        payable_type: payableType,
        payable_id: payableId,
        status: 'PENDING',
      },
      order: { created_at: 'DESC' },
    });
    if (!invoice) return;

    invoice.status = 'CANCELLED';
    invoice.cancelled_at = new Date();
    await invoiceRepo.save(invoice);

    const pending = await txRepo.findOne({
      where: { invoice_id: invoice.id, status: 'PENDING' },
    });
    if (pending) {
      pending.status = 'ABANDONED';
      await txRepo.save(pending);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Initialize — start (or resume) a Paystack checkout for an invoice
  // ─────────────────────────────────────────────────────────────────────

  async initializePayment(params: {
    payableType: string;
    payableId: string;
    email: string;
    initiatedByUserId?: string | null;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    reference: string;
    authorization_url: string;
    access_code: string;
    amount: number;
    currency: string;
  }> {
    const reserved = await this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(Invoice);
      const txRepo = manager.getRepository(PaymentTransaction);

      const invoice = await invoiceRepo
        .createQueryBuilder('i')
        .setLock('pessimistic_write')
        .where('i.payable_type = :type AND i.payable_id = :id', {
          type: params.payableType,
          id: params.payableId,
        })
        .orderBy('i.created_at', 'DESC')
        .getOne();
      if (!invoice) {
        throw new NotFoundException('No invoice found for this booking');
      }
      if (invoice.status === 'PAID') {
        throw new BadRequestException('This booking is already paid');
      }
      if (invoice.status === 'CANCELLED') {
        throw new BadRequestException(
          'This booking was cancelled — payment can no longer be initiated',
        );
      }
      if (Number(invoice.amount) <= 0) {
        throw new UnprocessableEntityException(
          'This invoice has no fee configured — configure a Payment Type before it can be paid',
        );
      }

      const existing = await txRepo.findOne({
        where: { invoice_id: invoice.id, status: 'PENDING' },
        order: { created_at: 'DESC' },
      });
      if (existing?.paystack_authorization_url) {
        const ageMinutes =
          (Date.now() - existing.created_at.getTime()) / 60_000;
        if (ageMinutes < STALE_PENDING_MINUTES) {
          return { kind: 'reused' as const, transaction: existing, invoice };
        }
      }
      if (existing) {
        existing.status = 'ABANDONED';
        await txRepo.save(existing);
      }

      const reference = this.generateReference();
      const placeholder = txRepo.create({
        reference,
        invoice_id: invoice.id,
        gateway: 'PAYSTACK',
        status: 'PENDING',
        amount: invoice.amount,
        currency: invoice.currency,
        customer_email: params.email,
        initiated_by: params.initiatedByUserId ?? null,
      });
      const saved = await txRepo.save(placeholder);
      return { kind: 'created' as const, transaction: saved, invoice };
    });

    if (reserved.kind === 'reused') {
      const { transaction, invoice } = reserved;
      return {
        reference: transaction.reference,
        authorization_url: transaction.paystack_authorization_url!,
        access_code: transaction.paystack_access_code ?? '',
        amount: Number(invoice.amount),
        currency: invoice.currency,
      };
    }

    const { transaction: created, invoice } = reserved;
    try {
      const paystackResponse = await this.paystackClient.initializeTransaction({
        email: params.email,
        amountNaira: Number(invoice.amount),
        reference: created.reference,
        callbackUrl: params.callbackUrl,
        metadata: params.metadata,
      });
      created.paystack_authorization_url =
        paystackResponse.data.authorization_url;
      created.paystack_access_code = paystackResponse.data.access_code;
      await this.transactionRepository.save(created);
      return {
        reference: created.reference,
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code,
        amount: Number(invoice.amount),
        currency: invoice.currency,
      };
    } catch (error) {
      created.status = 'FAILED';
      created.gateway_response =
        error instanceof Error ? error.message : 'Paystack initialize failed';
      await this.transactionRepository.save(created);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Verify — manual fallback + webhook + reconciliation all converge here
  // ─────────────────────────────────────────────────────────────────────

  /** Called by the SuperAdmin-facing manual-verify endpoint after Paystack checkout redirect-back. */
  async verifyPaymentForPayable(params: {
    payableType: string;
    payableId: string;
    reference?: string;
  }): Promise<PaymentTransaction> {
    const invoice = await this.getInvoiceForPayable(
      params.payableType,
      params.payableId,
    );
    if (!invoice) {
      throw new NotFoundException('No invoice found for this booking');
    }
    let reference = params.reference;
    if (reference) {
      const belongsToInvoice = await this.transactionRepository.findOne({
        where: { reference, invoice_id: invoice.id },
      });
      if (!belongsToInvoice) {
        throw new BadRequestException(
          'Reference does not belong to this booking',
        );
      }
    } else {
      const latest = await this.transactionRepository.findOne({
        where: { invoice_id: invoice.id },
        order: { created_at: 'DESC' },
      });
      if (!latest) {
        throw new NotFoundException(
          'No payment attempt has been initialized for this booking yet',
        );
      }
      reference = latest.reference;
    }
    return this.finalizeTransaction(reference, 'manual');
  }

  /**
   * For the Paystack checkout redirect-back page — Paystack's callback URL
   * only ever carries `?reference=...`/`?trxref=...`, never a booking id, so
   * this doesn't need (and can't require) a payable id in the request.
   */
  async verifyByReference(reference: string): Promise<Record<string, unknown>> {
    await this.finalizeTransaction(reference, 'manual');
    const transaction = await this.transactionRepository.findOne({
      where: { reference },
      relations: ['invoice'],
    });
    if (!transaction) {
      throw new NotFoundException(
        `No transaction found for reference ${reference}`,
      );
    }
    return this.mapTransactionResponse(transaction);
  }

  /**
   * The critical locked path — webhook, manual-verify, and the
   * reconciliation cron all call this for a given reference. Wraps
   * transaction + invoice + payable sync in one DB transaction so a crash
   * mid-way can never leave money collected but the payable still PENDING.
   * Idempotent: a concurrent second call for the same reference blocks on
   * the row lock, then sees SUCCESSFUL/FAILED and short-circuits.
   */
  async finalizeTransaction(
    reference: string,
    source: 'webhook' | 'manual' | 'reconciliation',
  ): Promise<PaymentTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(PaymentTransaction);
      const invoiceRepo = manager.getRepository(Invoice);

      const transaction = await txRepo
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.reference = :reference', { reference })
        .getOne();
      if (!transaction) {
        throw new NotFoundException(
          `No transaction found for reference ${reference}`,
        );
      }
      if (
        transaction.status === 'SUCCESSFUL' ||
        transaction.status === 'FAILED'
      ) {
        return transaction; // idempotent no-op — already terminal
      }

      const verify = await this.paystackClient.verifyTransaction(reference);
      const paystackData = verify.data;
      const expectedKobo = Math.round(Number(transaction.amount) * 100);
      const amountMismatch = paystackData.amount !== expectedKobo;
      const currencyMismatch =
        Boolean(paystackData.currency) &&
        paystackData.currency !== transaction.currency;

      transaction.raw_response = paystackData as unknown as Record<
        string,
        unknown
      >;
      transaction.channel = paystackData.channel ?? transaction.channel;

      if (
        paystackData.status !== 'success' ||
        amountMismatch ||
        currencyMismatch
      ) {
        transaction.status = 'FAILED';
        transaction.gateway_response =
          amountMismatch || currencyMismatch
            ? `Amount/currency mismatch — expected ${expectedKobo} ${transaction.currency}, Paystack reported ${paystackData.amount} ${paystackData.currency}`
            : (paystackData.gateway_response ?? 'Payment not successful');
        await txRepo.save(transaction);

        const invoice = await invoiceRepo.findOne({
          where: { id: transaction.invoice_id },
        });
        if (invoice) {
          await this.syncPayable(manager, invoice, transaction, 'FAILED');
        }
        this.logger.warn(
          `Transaction ${reference} finalized as FAILED via ${source} (paystack status=${paystackData.status})`,
        );
        return transaction;
      }

      transaction.status = 'SUCCESSFUL';
      transaction.gateway_response =
        paystackData.gateway_response ?? 'Approved';
      transaction.paid_at = paystackData.paid_at
        ? new Date(paystackData.paid_at)
        : new Date();
      await txRepo.save(transaction);

      const invoice = await invoiceRepo
        .createQueryBuilder('i')
        .setLock('pessimistic_write')
        .where('i.id = :id', { id: transaction.invoice_id })
        .getOne();
      if (!invoice) {
        this.logger.error(
          `Transaction ${reference} succeeded but its invoice ${transaction.invoice_id} is missing`,
        );
        return transaction;
      }

      let outcome: PaymentFinalizeOutcome = 'PAID';
      if (invoice.status === 'PENDING') {
        invoice.status = 'PAID';
        invoice.paid_at = transaction.paid_at;
        await invoiceRepo.save(invoice);
      } else if (invoice.status === 'CANCELLED') {
        // Real money was collected for a since-cancelled booking. Per
        // product decision, no refund automation — record the truthful
        // gateway ledger and flag the anomaly; do not un-cancel anything.
        outcome = 'PAID_AFTER_CANCELLED';
      }

      await this.syncPayable(manager, invoice, transaction, outcome);
      return transaction;
    });
  }

  private async syncPayable(
    manager: EntityManager,
    invoice: Invoice,
    transaction: PaymentTransaction,
    outcome: PaymentFinalizeOutcome,
  ) {
    const handler = this.payableHandlers.get(invoice.payable_type);
    if (!handler) {
      this.logger.warn(
        `No payable sync handler registered for payable_type=${invoice.payable_type}`,
      );
      return;
    }
    await handler.onPaymentFinalized({
      manager,
      invoice,
      transaction,
      outcome,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Webhook — logging + dispatch (signature check already done by the guard)
  // ─────────────────────────────────────────────────────────────────────

  async handleWebhookEvent(params: {
    signatureValid: boolean;
    payload: { event?: string; data?: { reference?: string } };
  }): Promise<void> {
    const eventType = params.payload?.event ?? 'unknown';
    const reference = params.payload?.data?.reference ?? null;

    const log = this.webhookEventRepository.create({
      provider: 'PAYSTACK',
      event_type: eventType,
      reference,
      signature_valid: params.signatureValid,
      payload: params.payload as Record<string, unknown>,
      processed: false,
    });

    if (!params.signatureValid) {
      await this.webhookEventRepository.save(log);
      return;
    }
    if (!reference) {
      log.processing_error = 'Payload missing data.reference';
      await this.webhookEventRepository.save(log);
      return;
    }

    try {
      if (eventType === 'charge.success' || eventType === 'charge.failed') {
        await this.finalizeTransaction(reference, 'webhook');
        log.processed = true;
      } else if (
        eventType === 'charge.dispute.create' ||
        eventType === 'refund.processed'
      ) {
        await this.logOnlyPayableEvent(reference, eventType);
        log.processed = true;
      } else {
        log.processing_error = `Unhandled event type: ${eventType}`;
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        log.processing_error = `Unknown reference: ${reference}`;
      } else {
        log.processing_error =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Webhook processing failed for ${eventType}/${reference}`,
          error as Error,
        );
      }
    }
    await this.webhookEventRepository.save(log);
  }

  private async logOnlyPayableEvent(reference: string, eventType: string) {
    const transaction = await this.transactionRepository.findOne({
      where: { reference },
    });
    if (!transaction) {
      throw new NotFoundException(
        `No transaction found for reference ${reference}`,
      );
    }
    const invoice = await this.invoiceRepository.findOne({
      where: { id: transaction.invoice_id },
    });
    if (!invoice) return;
    const handler = this.payableHandlers.get(invoice.payable_type);
    if (!handler) return;

    const eventLabel =
      eventType === 'charge.dispute.create'
        ? 'PAYMENT_DISPUTE_OPENED'
        : 'PAYMENT_REFUNDED_MANUALLY';
    await this.dataSource.transaction((manager) =>
      handler.onPayableEvent({
        manager,
        payableId: invoice.payable_id,
        eventLabel,
        notes: `Paystack ${eventType} event received for reference ${reference}.`,
      }),
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Reconciliation
  // ─────────────────────────────────────────────────────────────────────

  /** Re-verifies any PaymentTransaction still PENDING past the reconciliation window. Called by ReconciliationService's cron. */
  async reconcilePendingTransactions(
    olderThanMinutes: number,
  ): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const pending = await this.transactionRepository
      .createQueryBuilder('t')
      .where('t.status = :status', { status: 'PENDING' })
      .andWhere('t.paystack_authorization_url IS NOT NULL')
      .andWhere('t.created_at <= :cutoff', { cutoff })
      .getMany();

    let reconciled = 0;
    for (const transaction of pending) {
      try {
        await this.finalizeTransaction(transaction.reference, 'reconciliation');
        reconciled += 1;
      } catch (error) {
        this.logger.error(
          `Reconciliation failed for ${transaction.reference}`,
          error as Error,
        );
      }
    }
    return reconciled;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Admin/list surface
  // ─────────────────────────────────────────────────────────────────────

  async listPayments(query: QueryPaymentsDto) {
    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.invoice', 'invoice');
    if (query.status) {
      qb.andWhere('t.status = :status', { status: query.status });
    }
    if (query.search?.trim()) {
      qb.andWhere(
        '(t.reference ILIKE :search OR invoice.invoice_number ILIKE :search OR t.customer_email ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }
    if (query.date_from) {
      qb.andWhere('t.created_at >= :from', {
        from: `${query.date_from}T00:00:00.000Z`,
      });
    }
    if (query.date_to) {
      qb.andWhere('t.created_at <= :to', {
        to: `${query.date_to}T23:59:59.999Z`,
      });
    }
    qb.orderBy('t.created_at', 'DESC');

    const result = await paginateQueryBuilder(
      qb,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return {
      data: result.data.map((t) => this.mapTransactionResponse(t)),
      meta: result.meta,
    };
  }

  async findPayment(id: string): Promise<Record<string, unknown>> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ['invoice'],
    });
    if (!transaction) {
      throw new NotFoundException('Payment transaction not found');
    }
    return this.mapTransactionResponse(transaction);
  }

  mapTransactionResponse(
    transaction: PaymentTransaction,
  ): Record<string, unknown> {
    return {
      id: transaction.id,
      reference: transaction.reference,
      invoice_id: transaction.invoice_id,
      invoice_number: transaction.invoice?.invoice_number,
      // Lets the payment-callback page redirect back to the right booking
      // once it's the only thing that knows the Paystack reference.
      payable_type: transaction.invoice?.payable_type,
      payable_id: transaction.invoice?.payable_id,
      gateway: transaction.gateway,
      status: transaction.status,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      customer_email: transaction.customer_email ?? undefined,
      paystack_authorization_url:
        transaction.paystack_authorization_url ?? undefined,
      channel: transaction.channel ?? undefined,
      gateway_response: transaction.gateway_response ?? undefined,
      paid_at: transaction.paid_at ?? undefined,
      created_at: transaction.created_at,
    };
  }

  // ─────────────────────────────────────────────────────────────────────

  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    return nextSequentialCode(
      this.invoiceRepository,
      'invoice_number',
      `INV-${year}`,
      6,
    );
  }

  private generateReference(): string {
    return `MTMS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }
}
