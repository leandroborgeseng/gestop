import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './jwt';

export type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: JwtPayload;
  /** 285: sessão já resolvida no banco nesta requisição. */
  sessaoResolvida?: boolean;
  /** 285: requisição já autorizada pelo guard global da matriz. */
  matrizAutorizada?: boolean;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
