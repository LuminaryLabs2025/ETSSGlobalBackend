import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TeamMembersService } from './team-members.service';
import { TeamMembersController } from './team-members.controller';
import { User } from '../../database/entities/user.entity';
import { UserType } from '../../database/entities/user-type.entity';
import { Company } from '../../database/entities/company.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { UserTypePermission } from '../../database/entities/user-type-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import { EMAIL_QUEUE } from '../queue/queue.constants';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserType,
      Company,
      UserPermission,
      UserTypePermission,
      Permission,
    ]),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
    ActivityLogModule,
  ],
  controllers: [TeamMembersController],
  providers: [TeamMembersService],
  exports: [TeamMembersService],
})
export class TeamMembersModule {}
