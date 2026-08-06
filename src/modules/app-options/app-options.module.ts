import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BookingCategory,
  Facility,
  FacilityTimeslot,
  FacilityTimeslotAssignment,
  FacilityType,
  FacilityTypeParkType,
  HandheldDevice,
  InfractionCategory,
  Location,
  ParkType,
  PaymentType,
  RfidTag,
  TepType,
  TepTypeBookingCategory,
  TepTypeTruckType,
  TruckTypeBookingCategory,
  Terminal,
  TerminalGate,
  TransitPark,
  Barrier,
  BarrierSiteLink,
  TruckCapacity,
  TruckLength,
  TruckType,
  User,
  UserType,
} from '../../database/entities';
import { AppOptionsController } from './app-options.controller';
import { AppOptionsService } from './app-options.service';
import { BarriersController } from './barriers.controller';
import { BarriersService } from './barriers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TruckType,
      TruckCapacity,
      TruckLength,
      BookingCategory,
      TepType,
      TepTypeBookingCategory,
      TepTypeTruckType,
      TruckTypeBookingCategory,
      ParkType,
      FacilityType,
      FacilityTypeParkType,
      FacilityTimeslot,
      FacilityTimeslotAssignment,
      PaymentType,
      InfractionCategory,
      TerminalGate,
      Barrier,
      BarrierSiteLink,
      Facility,
      TransitPark,
      Terminal,
      Location,
      HandheldDevice,
      RfidTag,
      UserType,
      User,
    ]),
  ],
  controllers: [AppOptionsController, BarriersController],
  providers: [AppOptionsService, BarriersService],
  exports: [BarriersService],
})
export class AppOptionsModule {}
