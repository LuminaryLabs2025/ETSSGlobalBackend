import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { Disable2FADto } from './dto/disable-2fa.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

@ApiTags('profile')
@ApiBearerAuth('access-token')
@Controller('api/profile')
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@CurrentUser('id') userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Patch()
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, dto);
  }

  @Post('change-password')
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.profileService.changePassword(userId, dto);
  }

  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser('id') userId: string) {
    return this.profileService.setupTwoFactor(userId);
  }

  @Post('2fa/verify')
  verifyTwoFactor(
    @CurrentUser('id') userId: string,
    @Body() dto: Verify2FADto,
  ) {
    return this.profileService.verifyTwoFactor(userId, dto);
  }

  @Post('2fa/disable')
  disableTwoFactor(
    @CurrentUser('id') userId: string,
    @Body() dto: Disable2FADto,
  ) {
    return this.profileService.disableTwoFactor(userId, dto);
  }

  @Patch('notifications')
  updateNotificationSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.profileService.updateNotificationSettings(userId, dto);
  }
}
