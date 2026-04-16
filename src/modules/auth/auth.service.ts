import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { IsNull, MoreThan, Raw, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { User } from '../../database/entities/user.entity';
import { Permission } from '../../database/entities/permission.entity';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CompleteInviteDto } from './dto/complete-invite.dto';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { UserStatus } from '../../common/enums';
import { normalizeEmail } from '../../common/utils/email-normalize';
import {
  EMAIL_QUEUE,
  JOB_PASSWORD_RESET_EMAIL,
  JOB_TWO_FACTOR_EMAIL,
} from '../queue/queue.constants';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityLogEntryStatus, TwoFactorMethod } from '../../common/enums';
import { VerifyLoginTwoFactorDto } from './dto/verify-login-2fa.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly activityLogService: ActivityLogService,
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
  ) {}

  async login(loginDto: LoginDto) {
    const { password } = loginDto;
    const emailNorm = normalizeEmail(loginDto.email);

    const user = await this.userRepository.findOne({
      where: {
        email: Raw((alias) => `LOWER(TRIM(${alias})) = :e`, { e: emailNorm }),
      },
      relations: [
        'user_type',
        'user_permissions',
        'user_permissions.permission',
      ],
    });

    if (!user) {
      await this.activityLogService.recordEvent({
        action: 'LOGIN_FAILED',
        module: 'Authentication',
        metadata: {
          email: emailNorm,
          reason: 'user_not_found',
        },
        status: ActivityLogEntryStatus.FAILED,
        errorMessage: 'Invalid credentials',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (
      user.status === UserStatus.INACTIVE ||
      user.status === UserStatus.ARCHIVED
    ) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.activityLogService.recordEvent({
        userId: user.id,
        action: 'LOGIN_FAILED',
        module: 'Authentication',
        metadata: {
          email: user.email,
          reason: 'invalid_password',
        },
        status: ActivityLogEntryStatus.FAILED,
        errorMessage: 'Invalid credentials',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const challengeMethod = await this.prepareTwoFactorChallenge(user);
    const temporaryToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        purpose: '2fa_pending',
        method: challengeMethod,
      },
      { expiresIn: '10m' },
    );

    return {
      temporary_token: temporaryToken,
      message: '2FA verification required',
      two_factor_method: challengeMethod,
    };
  }

  async verifyLoginTwoFactor(dto: VerifyLoginTwoFactorDto) {
    let payload: {
      sub: string;
      email: string;
      purpose: string;
      method: TwoFactorMethod;
    };

    try {
      payload = this.jwtService.verify(dto.temporary_token);
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    if (payload.purpose !== '2fa_pending') {
      throw new UnauthorizedException('Invalid temporary token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: [
        'user_type',
        'user_permissions',
        'user_permissions.permission',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.assertValidTwoFactorCode(user, dto.code, payload.method);

    if (user.status === UserStatus.AWAITING_ACTIVATION) {
      user.status = UserStatus.ACTIVE;
    }

    user.two_factor_code = null;
    user.two_factor_code_expires_at = null;
    await this.userRepository.save(user);

    const permissions = await this.resolvePermissionNames(user);
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      is_super_admin: user.is_super_admin,
      company_id: user.company_id,
      permissions,
    };

    await this.activityLogService.recordEvent({
      userId: user.id,
      action: 'LOGIN',
      module: 'Authentication',
      metadata: { method: payload.method },
    });
    await this.activityLogService.recordEvent({
      userId: user.id,
      action: 'TWO_FACTOR_VERIFIED',
      module: 'Authentication',
      metadata: { method: payload.method },
    });

    return {
      access_token: this.jwtService.sign(accessPayload),
      refresh_token: this.jwtService.sign(
        { sub: user.id, purpose: 'refresh' },
        { expiresIn: '7d' },
      ),
      user: this.buildAuthenticatedUserResponse(user, permissions),
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const emailNorm = normalizeEmail(dto.email);
    const user = await this.userRepository.findOne({
      where: {
        email: Raw((alias) => `LOWER(TRIM(${alias})) = :e`, { e: emailNorm }),
      },
    });

    if (user) {
      const token = randomUUID();
      user.password_reset_token = token;
      user.password_reset_expires_at = new Date(Date.now() + 15 * 60 * 1000);
      await this.userRepository.save(user);

      const resetLink = this.buildResetLink(token, user.email);
      try {
        await this.emailQueue.add(
          JOB_PASSWORD_RESET_EMAIL,
          {
            to: user.email,
            resetLink,
          },
          {
            removeOnComplete: true,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to enqueue password reset email for ${user.email}`,
          err,
        );
      }
    }

    return {
      success: true,
      message:
        'If that email exists in our system, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const emailNorm = normalizeEmail(dto.email);
    const user = await this.userRepository.findOne({
      where: {
        email: Raw((alias) => `LOWER(TRIM(${alias})) = :e`, { e: emailNorm }),
        password_reset_token: dto.token,
        password_reset_expires_at: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.password = await bcrypt.hash(dto.newPassword, 12);
    user.password_reset_token = null;
    user.password_reset_expires_at = null;
    user.password_changed_at = new Date();
    await this.userRepository.save(user);
    await this.activityLogService.recordEvent({
      userId: user.id,
      action: 'PASSWORD_CHANGED',
      module: 'Authentication',
      metadata: { source: 'reset_password' },
    });

    return { success: true };
  }

  async completeInvite(dto: CompleteInviteDto) {
    const emailNorm = normalizeEmail(dto.email);
    const user = await this.userRepository.findOne({
      where: {
        email: Raw((alias) => `LOWER(TRIM(${alias})) = :e`, { e: emailNorm }),
        invite_token: dto.token,
        invite_token_expires_at: MoreThan(new Date()),
        invite_token_used_at: IsNull(),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid, expired, or already used invite link');
    }

    user.password = await bcrypt.hash(dto.newPassword, 12);
    user.password_changed_at = new Date();
    user.status = UserStatus.ACTIVE;
    user.invite_token_used_at = new Date();
    user.invite_token = null;
    user.invite_token_expires_at = null;
    await this.userRepository.save(user);
    await this.activityLogService.recordEvent({
      userId: user.id,
      action: 'USER_ONBOARDED',
      module: 'User Management',
      metadata: { source: 'invite_completion' },
    });

    return { success: true };
  }

  private async prepareTwoFactorChallenge(user: User): Promise<TwoFactorMethod> {
    const method = this.resolveLoginTwoFactorMethod(user);

    if (method === TwoFactorMethod.AUTHENTICATOR) {
      return method;
    }

    const code = this.generateNumericCode();
    user.two_factor_code = await bcrypt.hash(code, 10);
    user.two_factor_code_expires_at = new Date(Date.now() + 10 * 60 * 1000);
    await this.userRepository.save(user);

    if (method === TwoFactorMethod.EMAIL) {
      await this.emailQueue.add(
        JOB_TWO_FACTOR_EMAIL,
        { to: user.email, code },
        {
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    }

    return method;
  }

  private resolveLoginTwoFactorMethod(user: User): TwoFactorMethod {
    if (
      user.two_factor_method === TwoFactorMethod.AUTHENTICATOR &&
      user.two_factor_secret
    ) {
      return TwoFactorMethod.AUTHENTICATOR;
    }

    if (
      user.two_factor_method === TwoFactorMethod.SMS &&
      user.phone &&
      this.configService.get<string>('SMS_2FA_ENABLED', 'false') === 'true'
    ) {
      return TwoFactorMethod.SMS;
    }

    return TwoFactorMethod.EMAIL;
  }

  private async assertValidTwoFactorCode(
    user: User,
    code: string,
    method: TwoFactorMethod,
  ): Promise<void> {
    if (method === TwoFactorMethod.AUTHENTICATOR) {
      if (!user.two_factor_secret) {
        throw new BadRequestException('Authenticator app is not configured');
      }

      const isValid = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: code,
        window: 1,
      });

      if (!isValid) {
        await this.activityLogService.recordEvent({
          userId: user.id,
          action: 'TWO_FACTOR_VERIFICATION_FAILED',
          module: 'Authentication',
          metadata: { method },
          status: ActivityLogEntryStatus.FAILED,
          errorMessage: 'Invalid 2FA code',
        });
        throw new UnauthorizedException('Invalid 2FA code');
      }
      return;
    }

    if (
      !user.two_factor_code ||
      !user.two_factor_code_expires_at ||
      user.two_factor_code_expires_at.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('2FA code has expired');
    }

    const isValid = await bcrypt.compare(code, user.two_factor_code);
    if (!isValid) {
      await this.activityLogService.recordEvent({
        userId: user.id,
        action: 'TWO_FACTOR_VERIFICATION_FAILED',
        module: 'Authentication',
        metadata: { method },
        status: ActivityLogEntryStatus.FAILED,
        errorMessage: 'Invalid 2FA code',
      });
      throw new UnauthorizedException('Invalid 2FA code');
    }
  }

  private buildAuthenticatedUserResponse(user: User, permissions: string[]) {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_super_admin: user.is_super_admin,
      account_type: user.account_type,
      status: user.status,
      user_type: user.user_type
        ? { id: user.user_type.id, name: user.user_type.name }
        : null,
      company_id: user.company_id,
      permissions,
      created_at: user.created_at,
    };
  }

  private generateNumericCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async resolvePermissionNames(user: User): Promise<string[]> {
    if (user.is_super_admin) {
      const rows = await this.permissionRepository.find({
        select: ['name'],
        order: { name: 'ASC' },
      });
      return rows.map((r) => r.name);
    }
    const set = new Set<string>();
    user.user_permissions?.forEach((up) => {
      if (up.permission?.name) set.add(up.permission.name);
    });
    return Array.from(set);
  }

  private buildResetLink(token: string, email: string): string {
    const frontendBase = this.getFrontendBaseUrl();
    const resetPath = this.configService.get<string>(
      'RESET_PASSWORD_PATH',
      '/reset-password',
    );
    const path = resetPath.startsWith('/') ? resetPath : `/${resetPath}`;
    const query = new URLSearchParams({
      token,
      email,
    }).toString();
    return `${frontendBase}${path}?${query}`;
  }

  private getFrontendBaseUrl(): string {
    return this.configService
      .get<string>('FRONTEND_URL', 'https://etss-global.onrender.com')
      .replace(/\/$/, '');
  }
}
