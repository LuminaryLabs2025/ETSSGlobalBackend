import { ApiProperty } from '@nestjs/swagger';

class UserTypeSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class AuthenticatedUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  first_name: string;

  @ApiProperty()
  last_name: string;

  @ApiProperty()
  is_super_admin: boolean;

  @ApiProperty()
  account_type: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: () => UserTypeSummaryResponseDto, nullable: true })
  user_type: UserTypeSummaryResponseDto | null;

  @ApiProperty({ nullable: true })
  company_id: string | null;

  @ApiProperty({ type: [String] })
  permissions: string[];

  @ApiProperty()
  created_at: Date;
}

export class LoginChallengeResponseDto {
  @ApiProperty()
  temporary_token: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  two_factor_method: string;
}

export class LoginSuccessResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  refresh_token: string;

  @ApiProperty({ type: () => AuthenticatedUserResponseDto })
  user: AuthenticatedUserResponseDto;
}

export class AuthSuccessResponseDto {
  @ApiProperty()
  success: boolean;
}
