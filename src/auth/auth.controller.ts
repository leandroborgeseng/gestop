import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  @Post('logout')
  logout() {
    return { ok: true };
  }
}
