import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyLoginTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  temporary_token: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit code' })
  code: string;
}
