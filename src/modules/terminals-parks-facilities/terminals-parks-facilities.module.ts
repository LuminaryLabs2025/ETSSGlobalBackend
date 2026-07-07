import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Facility,
  FacilityTimeslot,
  FacilityTimeslotAssignment,
  Location,
  Terminal,
  TransitPark,
} from '../../database/entities';
import { TerminalsParksFacilitiesController } from './terminals-parks-facilities.controller';
import { TerminalsParksFacilitiesService } from './terminals-parks-facilities.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Terminal,
      TransitPark,
      Facility,
      Location,
      FacilityTimeslot,
      FacilityTimeslotAssignment,
    ]),
  ],
  controllers: [TerminalsParksFacilitiesController],
  providers: [TerminalsParksFacilitiesService],
})
export class TerminalsParksFacilitiesModule {}
