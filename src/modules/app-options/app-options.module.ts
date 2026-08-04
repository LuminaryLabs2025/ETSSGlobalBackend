import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BookingCategory,
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
  TerminalGate,
  TruckCapacity,
  TruckLength,
  TruckType,
  User,
  UserType,
} from '../../database/entities';
import { AppOptionsController } from './app-options.controller';
import { AppOptionsService } from './app-options.service';

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
      Location,
      HandheldDevice,
      RfidTag,
      UserType,
      User,
    ]),
  ],
  controllers: [AppOptionsController],
  providers: [AppOptionsService],
})
export class AppOptionsModule {}
