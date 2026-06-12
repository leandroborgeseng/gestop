import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from '../config/env';
import { isUuid } from '../common/uuid';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './current-user';
import { verifyJwt } from './jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = getNodeHeader(request, 'authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;

    if (!token) {
      throw new UnauthorizedException('Sessao obrigatoria');
    }

    try {
      request.user = verifyJwt(token, this.getJwtSecret());
    } catch {
      throw new UnauthorizedException('Sessao invalida ou expirada');
    }

    const userId = request.user.sub?.trim();
    if (!isUuid(userId)) {
      throw new UnauthorizedException('Sessao invalida ou expirada');
    }

    try {
      const session = await this.authService.resolveActiveSession(userId);
      request.user = {
        ...request.user,
        perfis: session.perfis,
        permissoes: session.permissoes,
        secretariaId: session.secretariaId,
      };
    } catch {
      throw new UnauthorizedException('Sessao invalida ou expirada');
    }

    return true;
  }

  private getJwtSecret() {
    return resolveJwtSecret(this.configService.get<string>('JWT_SECRET'));
  }
}

function getNodeHeader(request: unknown, name: string) {
  const headers = (request as { headers?: Record<string, string | string[] | undefined> }).headers;
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}
