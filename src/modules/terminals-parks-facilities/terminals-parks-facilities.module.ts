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
import { AppOptionsModule } from '../app-options/app-options.module';
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
    AppOptionsModule,
  ],
  controllers: [TerminalsParksFacilitiesController],
  providers: [TerminalsParksFacilitiesService],
})
export class TerminalsParksFacilitiesModule {}
