import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';

const DEFAULT_WINDOW_MINUTES = 10;

/**
 * Re-verifies any PaymentTransaction still PENDING past a window — fixes the
 * "webhook missed and the user never returns to trigger manual-verify"
 * gap. Uses @nestjs/schedule (already wired for KeepAliveService) rather
 * than the BullMQ/Redis queue so this has no dependency on Redis being up.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Cron(process.env.PAYSTACK_RECONCILE_CRON ?? '*/10 * * * *')
  async reconcile(): Promise<void> {
    try {
      const count = await this.paymentsService.reconcilePendingTransactions(
        DEFAULT_WINDOW_MINUTES,
      );
      if (count > 0) {
        this.logger.log(`Reconciled ${count} pending Paystack transaction(s)`);
      }
    } catch (error) {
      this.logger.error('Payment reconciliation run failed', error as Error);
    }
  }
}
