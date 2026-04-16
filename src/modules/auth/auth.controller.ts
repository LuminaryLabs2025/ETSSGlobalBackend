import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CompleteInviteDto } from './dto/complete-invite.dto';
import { VerifyLoginTwoFactorDto } from './dto/verify-login-2fa.dto';
import {
  AuthSuccessResponseDto,
  LoginChallengeResponseDto,
  LoginSuccessResponseDto,
} from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginChallengeResponseDto })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('login/verify-2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginSuccessResponseDto })
  async verifyLoginTwoFactor(@Body() dto: VerifyLoginTwoFactorDto) {
    return this.authService.verifyLoginTwoFactor(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthSuccessResponseDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthSuccessResponseDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('join-invite/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthSuccessResponseDto })
  async completeInvite(@Body() dto: CompleteInviteDto) {
    return this.authService.completeInvite(dto);
  }
}
