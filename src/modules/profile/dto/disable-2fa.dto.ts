import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class Disable2FADto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'token must be a 6-digit code' })
  token: string;
}
