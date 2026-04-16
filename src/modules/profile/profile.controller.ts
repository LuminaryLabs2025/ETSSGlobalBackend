import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdateTwoFactorMethodDto } from './dto/update-two-factor-method.dto';
import {
  ChangePasswordResponseDto,
  NotificationSettingsResponseDto,
  ProfileResponseDto,
  SetupTwoFactorResponseDto,
  VerifyTwoFactorResponseDto,
} from './dto/profile-response.dto';

@ApiTags('profile')
@ApiBearerAuth('access-token')
@Controller('api/profile')
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOkResponse({ type: ProfileResponseDto })
  getProfile(@CurrentUser('id') userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Patch()
  @ApiOkResponse({ type: ProfileResponseDto })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, dto);
  }

  @Post('change-password')
  @ApiOkResponse({ type: ChangePasswordResponseDto })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.profileService.changePassword(userId, dto);
  }

  @Post('2fa/setup')
  @ApiOkResponse({ type: SetupTwoFactorResponseDto })
  setupTwoFactor(@CurrentUser('id') userId: string) {
    return this.profileService.setupTwoFactor(userId);
  }

  @Post('2fa/verify')
  @ApiOkResponse({ type: VerifyTwoFactorResponseDto })
  verifyTwoFactor(
    @CurrentUser('id') userId: string,
    @Body() dto: Verify2FADto,
  ) {
    return this.profileService.verifyTwoFactor(userId, dto);
  }

  @Patch('2fa/method')
  @ApiOkResponse({ type: VerifyTwoFactorResponseDto })
  updateTwoFactorMethod(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTwoFactorMethodDto,
  ) {
    return this.profileService.updateTwoFactorMethod(userId, dto);
  }

  @Patch('notifications')
  @ApiOkResponse({ type: NotificationSettingsResponseDto })
  updateNotificationSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.profileService.updateNotificationSettings(userId, dto);
  }
}
