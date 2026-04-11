import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../../database/entities/user.entity';
import { UserType } from '../../database/entities/user-type.entity';
import { Company } from '../../database/entities/company.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';
import { ActivityLog } from '../../database/entities/activity-log.entity';
import { MetadataValidatorService } from '../../common/services/metadata-validator.service';
import { EMAIL_QUEUE } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserType,
      Company,
      UserRole,
      Role,
      ActivityLog,
    ]),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
  ],
  controllers: [UsersController],
  providers: [UsersService, MetadataValidatorService],
  exports: [UsersService],
})
export class UsersModule {}
