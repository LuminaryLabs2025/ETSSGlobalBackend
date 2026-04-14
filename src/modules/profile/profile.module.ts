import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { NotificationSettings } from '../../database/entities/notification-settings.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, NotificationSettings])],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
