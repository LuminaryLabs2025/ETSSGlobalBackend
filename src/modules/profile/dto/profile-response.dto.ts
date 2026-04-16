import { ApiProperty } from '@nestjs/swagger';

class PersonalInformationResponseDto {
  @ApiProperty({ nullable: true })
  fullName: string | null;

  @ApiProperty()
  email: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  company: string;

  @ApiProperty()
  accountType: string;

  @ApiProperty()
  accountStatus: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ nullable: true })
  address: string | null;
}

class SecurityAuditResponseDto {
  @ApiProperty({ nullable: true })
  passwordLastChanged: Date | null;

  @ApiProperty()
  twoFactorAuthentication: boolean;

  @ApiProperty()
  twoFactorMethod: string;

  @ApiProperty()
  accountCreated: Date;
}

export class NotificationSettingsResponseDto {
  @ApiProperty()
  emailNotifications: boolean;

  @ApiProperty()
  smsNotifications: boolean;

  @ApiProperty()
  updatedAt: Date;
}

export class ProfileResponseDto {
  @ApiProperty({ type: () => PersonalInformationResponseDto })
  personalInformation: PersonalInformationResponseDto;

  @ApiProperty({ type: () => SecurityAuditResponseDto })
  securityAudit: SecurityAuditResponseDto;

  @ApiProperty({ type: () => NotificationSettingsResponseDto })
  notifications: NotificationSettingsResponseDto;
}

export class ChangePasswordResponseDto {
  @ApiProperty()
  success: boolean;
}

export class SetupTwoFactorResponseDto {
  @ApiProperty()
  qrCode: string;

  @ApiProperty()
  secret: string;
}

export class VerifyTwoFactorResponseDto {
  @ApiProperty()
  twoFactorEnabled: boolean;

  @ApiProperty()
  twoFactorMethod: string;
}
