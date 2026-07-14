import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  UtilityAssignedPersonnel,
  UtilityTicket,
  UtilityTicketHistory,
  User,
} from '../../database/entities';
import { UtilityTicketsController } from './utility-tickets.controller';
import { UtilityTicketsService } from './utility-tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UtilityTicket,
      UtilityTicketHistory,
      UtilityAssignedPersonnel,
      User,
    ]),
  ],
  controllers: [UtilityTicketsController],
  providers: [UtilityTicketsService],
  exports: [UtilityTicketsService],
})
export class UtilityTicketsModule {}
