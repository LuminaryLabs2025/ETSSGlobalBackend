import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Booking,
  BookingCategory,
  BookingTimelineEntry,
  Company,
  Driver,
  Facility,
  FacilityTimeslot,
  PaymentType,
  Tep,
  Terminal,
  TransitPark,
  Truck,
} from '../../database/entities';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingTimelineEntry,
      Truck,
      Driver,
      Company,
      Facility,
      TransitPark,
      Terminal,
      BookingCategory,
      FacilityTimeslot,
      Tep,
      PaymentType,
    ]),
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
