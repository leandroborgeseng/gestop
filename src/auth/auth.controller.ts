import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user';
import { AuthService } from './auth.service';
import { JwtPayload } from './jwt';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH_LOGIN,
  PASSWORD_MIN_LENGTH_NEW,
} from './password-policy';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH_LOGIN)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH_LOGIN)
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH_NEW)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword!: string;
}

class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH_NEW)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password, body.remember);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.getUserProfile(user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser() user: JwtPayload, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, body.currentPassword, body.newPassword);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPasswordWithToken(body.token, body.newPassword);
  }

  @Post('logout')
  logout() {
    return { ok: true };
  }
}
