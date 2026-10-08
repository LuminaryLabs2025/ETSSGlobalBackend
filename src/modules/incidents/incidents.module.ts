import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Booking,
  Company,
  Driver,
  Facility,
  Incident,
  IncidentEvent,
  IncidentEvidence,
  IncidentNote,
  Terminal,
  TransitPark,
  Truck,
  User,
} from '../../database/entities';
import {
  IncidentReportsController,
  IncidentsController,
} from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incident,
      IncidentEvent,
      IncidentEvidence,
      IncidentNote,
      User,
      Company,
      Facility,
      TransitPark,
      Terminal,
      Truck,
      Driver,
      Booking,
    ]),
  ],
  controllers: [IncidentsController, IncidentReportsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
