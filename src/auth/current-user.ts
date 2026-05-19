import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './jwt';

export type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: JwtPayload;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
