import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DttrEditAudit,
  DttrSubmission,
  DttrTerminalRequest,
} from '../../database/entities';
import { DttrController } from './dttr.controller';
import { DttrService } from './dttr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DttrTerminalRequest,
      DttrSubmission,
      DttrEditAudit,
    ]),
  ],
  controllers: [DttrController],
  providers: [DttrService],
})
export class DttrModule {}
