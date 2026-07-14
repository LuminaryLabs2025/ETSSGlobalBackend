import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  FineDispute,
  FineDisputeEvent,
  IssuedFine,
  PenaltyDefinition,
} from '../../database/entities';
import { PenaltiesController } from './penalties.controller';
import { PenaltiesService } from './penalties.service';
import { IssuedFinesController } from './issued-fines.controller';
import { IssuedFinesService } from './issued-fines.service';
import { FineDisputesController } from './fine-disputes.controller';
import { FineDisputesService } from './fine-disputes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PenaltyDefinition,
      IssuedFine,
      FineDispute,
      FineDisputeEvent,
    ]),
  ],
  controllers: [
    PenaltiesController,
    IssuedFinesController,
    FineDisputesController,
  ],
  providers: [PenaltiesService, IssuedFinesService, FineDisputesService],
  exports: [PenaltiesService, IssuedFinesService, FineDisputesService],
})
export class FinesModule {}
