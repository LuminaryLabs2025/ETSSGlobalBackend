import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Company,
  Driver,
  DriverFlag,
  Tep,
  TepActivityEvent,
  TepMatchedTruck,
  Truck,
  TruckPenalty,
  User,
} from '../../database/entities';
import { TrucksController } from './trucks.controller';
import { TrucksService } from './trucks.service';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { TepsController } from './teps.controller';
import { TepsService } from './teps.service';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Truck,
      TruckPenalty,
      Driver,
      DriverFlag,
      Tep,
      TepMatchedTruck,
      TepActivityEvent,
      Company,
      User,
    ]),
  ],
  controllers: [
    TrucksController,
    DriversController,
    TepsController,
    DisputesController,
  ],
  providers: [TrucksService, DriversService, TepsService, DisputesService],
})
export class OperationsModule {}
