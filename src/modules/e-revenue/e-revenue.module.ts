import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Booking,
  PaymentTransaction,
  PaymentType,
  RevenueTransaction,
  User,
} from '../../database/entities';
import { PaymentsModule } from '../payments/payments.module';
import { ERevenueController } from './e-revenue.controller';
import { ERevenueService } from './e-revenue.service';
import { RevenueLedgerService } from './revenue-ledger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RevenueTransaction,
      PaymentType,
      PaymentTransaction,
      Booking,
      User,
    ]),
    PaymentsModule,
  ],
  controllers: [ERevenueController],
  providers: [ERevenueService, RevenueLedgerService],
})
export class ERevenueModule {}
