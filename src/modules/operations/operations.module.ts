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
  TruckCapacity,
  TruckLength,
  TruckPenalty,
  TruckType,
  User,
} from '../../database/entities';
import { TrucksController } from './trucks.controller';
import { TrucksService } from './trucks.service';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { TepsController } from './teps.controller';
import { TepsService } from './teps.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Truck,
      TruckType,
      TruckLength,
      TruckCapacity,
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
  controllers: [TrucksController, DriversController, TepsController],
  providers: [TrucksService, DriversService, TepsService],
})
export class OperationsModule {}
