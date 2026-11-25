import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { secretariaIdsDaQuery } from './secretaria-scope';

/** R3 (306): `secretariaId` da query sempre como array (aceita valor único, repetido ou `secretariaId[]`). */
export const SecretariaIdsQuery = createParamDecorator((_data: unknown, ctx: ExecutionContext): string[] => {
  const req = ctx.switchToHttp().getRequest<{ query?: Record<string, unknown> }>();
  return secretariaIdsDaQuery(req.query);
});
