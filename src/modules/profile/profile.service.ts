import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { User } from '../../database/entities/user.entity';
import { NotificationSettings } from '../../database/entities/notification-settings.entity';
import { TwoFactorMethod, UserStatus } from '../../common/enums';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdateTwoFactorMethodDto } from './dto/update-two-factor-method.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(NotificationSettings)
    private readonly notificationSettingsRepository: Repository<NotificationSettings>,
    private readonly configService: ConfigService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.findUserWithRelations(userId);
    const notificationSettings = await this.getOrCreateNotificationSettings(userId);
    return {
      personalInformation: this.toPersonalInformationResponse(user),
      securityAudit: this.toSecurityAuditResponse(user),
      notifications: this.toNotificationResponse(notificationSettings),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findUserWithRelations(userId);

    if (typeof dto.phone === 'string') {
      user.phone = dto.phone.trim() || null;
    }

    if (typeof dto.address === 'string') {
      user.address = dto.address.trim() || null;
    }

    await this.userRepository.save(user);
    const notificationSettings = await this.getOrCreateNotificationSettings(userId);
    return {
      personalInformation: this.toPersonalInformationResponse(user),
      securityAudit: this.toSecurityAuditResponse(user),
      notifications: this.toNotificationResponse(notificationSettings),
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.findUserById(userId);

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(dto.newPassword, 12);
    user.password_changed_at = new Date();
    if (user.status === UserStatus.AWAITING_ACTIVATION) {
      user.status = UserStatus.ACTIVE;
    }
    await this.userRepository.save(user);
    await this.activityLogService.recordEvent({
      userId: user.id,
      action: 'PASSWORD_CHANGED',
      module: 'Authentication',
      metadata: null,
    });

    return { success: true };
  }

  async setupTwoFactor(userId: string) {
    const user = await this.findUserById(userId);
    const appName = this.configService.get<string>('APP_NAME', 'Maritime ETSS');
    const issuer = encodeURIComponent(appName);
    const label = `${encodeURIComponent(appName)}:${encodeURIComponent(user.email)}`;
    const secret = speakeasy.generateSecret({
      name: `${appName} (${user.email})`,
      issuer: appName,
    });

    user.two_factor_enabled = true;
    user.two_factor_secret = secret.base32;
    await this.userRepository.save(user);

    const otpauthUrl =
      secret.otpauth_url ??
      `otpauth://totp/${label}?secret=${secret.base32}&issuer=${issuer}`;
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return {
      qrCode,
      secret: secret.base32,
    };
  }

  async verifyTwoFactor(userId: string, dto: Verify2FADto) {
    const user = await this.findUserById(userId);
    if (!user.two_factor_secret) {
      throw new BadRequestException('2FA setup has not been started');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: dto.token,
      window: 1,
    });
    if (!isValid) {
      throw new BadRequestException('Invalid 2FA token');
    }

    user.two_factor_enabled = true;
    user.two_factor_method = TwoFactorMethod.AUTHENTICATOR;
    await this.userRepository.save(user);
    await this.activityLogService.recordEvent({
      userId: user.id,
      action: 'TWO_FACTOR_METHOD_CHANGED',
      module: 'Authentication',
      metadata: { method: TwoFactorMethod.AUTHENTICATOR },
    });

    return {
      twoFactorEnabled: true,
      twoFactorMethod: user.two_factor_method,
    };
  }

  async updateTwoFactorMethod(userId: string, dto: UpdateTwoFactorMethodDto) {
    const user = await this.findUserById(userId);

    if (
      dto.method === TwoFactorMethod.AUTHENTICATOR &&
      !user.two_factor_secret
    ) {
      throw new BadRequestException(
        'Authenticator app must be configured before selecting it',
      );
    }

    if (dto.method === TwoFactorMethod.SMS && !user.phone) {
      throw new BadRequestException(
        'A phone number is required before selecting SMS 2FA',
      );
    }

    user.two_factor_enabled = true;
    user.two_factor_method = dto.method;
    await this.userRepository.save(user);
    await this.activityLogService.recordEvent({
      userId: user.id,
      action: 'TWO_FACTOR_METHOD_CHANGED',
      module: 'Authentication',
      metadata: { method: dto.method },
    });

    return {
      twoFactorEnabled: true,
      twoFactorMethod: user.two_factor_method,
    };
  }

  async updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ) {
    const settings = await this.getOrCreateNotificationSettings(userId);

    if (typeof dto.emailNotifications === 'boolean') {
      settings.email_notifications = dto.emailNotifications;
    }
    if (typeof dto.smsNotifications === 'boolean') {
      settings.sms_notifications = dto.smsNotifications;
    }
    const saved = await this.notificationSettingsRepository.save(settings);
    return this.toNotificationResponse(saved);
  }

  private async findUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async findUserWithRelations(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['user_type', 'company'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private toPersonalInformationResponse(user: User) {
    const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    return {
      fullName: fullName || null,
      email: user.email,
      role: this.resolveRoleLabel(user),
      company: user.company?.name ?? 'N/A',
      accountType: user.account_type,
      accountStatus: user.status,
      phone: user.phone ?? null,
      address: user.address ?? null,
    };
  }

  private async getOrCreateNotificationSettings(
    userId: string,
  ): Promise<NotificationSettings> {
    await this.findUserById(userId);
    const existing = await this.notificationSettingsRepository.findOne({
      where: { user_id: userId },
    });
    if (existing) {
      return existing;
    }

    const created = this.notificationSettingsRepository.create({
      user_id: userId,
      email_notifications: true,
      sms_notifications: false,
      push_notifications: false,
    });
    return this.notificationSettingsRepository.save(created);
  }

  private toNotificationResponse(settings: NotificationSettings) {
    return {
      emailNotifications: settings.email_notifications,
      smsNotifications: settings.sms_notifications,
      updatedAt: settings.updated_at,
    };
  }

  private toSecurityAuditResponse(user: User) {
    return {
      passwordLastChanged: user.password_changed_at,
      twoFactorAuthentication: true,
      twoFactorMethod: user.two_factor_method,
      accountCreated: user.created_at,
    };
  }

  private resolveRoleLabel(user: User): string {
    if (user.is_super_admin) {
      return 'Super Admin';
    }
    return user.user_type?.name ?? 'N/A';
  }
}
