import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user';
import { AuthService } from './auth.service';
import { JwtPayload } from './jwt';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      nome: user.nome,
      email: user.email,
      perfis: user.perfis,
      permissoes: user.permissoes,
    };
  }

  @UseGuards(AuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser() user: JwtPayload, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, body.currentPassword, body.newPassword);
  }

  @Post('logout')
  logout() {
    return { ok: true };
  }
}
