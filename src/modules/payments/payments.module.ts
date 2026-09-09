import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Invoice,
  PaymentTransaction,
  PaymentWebhookEvent,
} from '../../database/entities';
import { PaymentsService } from './payments.service';
import { PaystackClientService } from './paystack-client.service';
import { PaystackWebhookSignatureGuard } from './paystack-webhook-signature.guard';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      PaymentTransaction,
      PaymentWebhookEvent,
    ]),
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [
    PaymentsService,
    PaystackClientService,
    PaystackWebhookSignatureGuard,
    ReconciliationService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
