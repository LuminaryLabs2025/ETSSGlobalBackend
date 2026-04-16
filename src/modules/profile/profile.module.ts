import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { NotificationSettings } from '../../database/entities/notification-settings.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, NotificationSettings]),
    ActivityLogModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
