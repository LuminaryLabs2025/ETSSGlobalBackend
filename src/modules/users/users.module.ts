import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../../database/entities/user.entity';
import { UserType } from '../../database/entities/user-type.entity';
import { Company } from '../../database/entities/company.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { UserTypePermission } from '../../database/entities/user-type-permission.entity';
import { MetadataValidatorService } from '../../common/services/metadata-validator.service';
import { EMAIL_QUEUE } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserType,
      Company,
      UserPermission,
      UserTypePermission,
    ]),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
  ],
  controllers: [UsersController],
  providers: [UsersService, MetadataValidatorService],
  exports: [UsersService],
})
export class UsersModule {}
