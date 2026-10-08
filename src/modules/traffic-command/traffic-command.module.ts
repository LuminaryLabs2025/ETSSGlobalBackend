import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Barrier,
  BarrierSiteLink,
  BarrierTagEvent,
  Booking,
  Facility,
  HandheldDevice,
  Incident,
  RfidTag,
  Terminal,
  TransitPark,
  Truck,
} from '../../database/entities';
import { BookingsModule } from '../bookings/bookings.module';
import { TrafficCommandController } from './traffic-command.controller';
import { LiveTrucksService } from './live-trucks.service';
import { LiveLocationsService } from './live-locations.service';
import { OccService } from './occ.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      Facility,
      TransitPark,
      Terminal,
      Barrier,
      BarrierSiteLink,
      BarrierTagEvent,
      HandheldDevice,
      RfidTag,
      Truck,
      Incident,
    ]),
    BookingsModule,
  ],
  controllers: [TrafficCommandController],
  providers: [LiveTrucksService, LiveLocationsService, OccService],
})
export class TrafficCommandModule {}
