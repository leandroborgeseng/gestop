import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedRequest } from './current-user';
import { verifyJwt } from './jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = getNodeHeader(request, 'authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;

    if (!token) {
      throw new UnauthorizedException('Sessao obrigatoria');
    }

    try {
      request.user = verifyJwt(token, this.getJwtSecret());
      return true;
    } catch {
      throw new UnauthorizedException('Sessao invalida ou expirada');
    }
  }

  private getJwtSecret() {
    return this.configService.get<string>('JWT_SECRET') ?? 'gestop-dev-secret-change-me';
  }
}

function getNodeHeader(request: unknown, name: string) {
  const headers = (request as { headers?: Record<string, string | string[] | undefined> }).headers;
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}
