import { CanActivate, ExecutionContext, ForbiddenException, Injectable, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../auth.guard';
import type { AuthenticatedRequest } from '../current-user';
import { PermissionsGuard } from '../permissions.guard';
import { avaliarEntrada, ehAdministradorSistema } from './avaliar-matriz';
import { MENSAGEM_SEM_PERMISSAO, PERMISSOES_MATRIZ, type EntradaMatriz } from './permissoes-matriz';
import { chaveRotaPorHandler } from './rotas-descoberta';

export function negarAcesso(): never {
  throw new ForbiddenException(MENSAGEM_SEM_PERMISSAO);
}

/**
 * 285 fase 1 — guard GLOBAL único (APP_GUARD) que aplica a matriz de permissões.
 * - Rota sem entrada na matriz → 403 (deny-by-default).
 * - Roda antes do handler: em 403 nada é persistido.
 */
@Injectable()
export class MatrizPermissoesGuard implements CanActivate {
  private matriz: Record<string, EntradaMatriz> = PERMISSOES_MATRIZ;

  constructor(
    private readonly authGuard: AuthGuard,
    private readonly reflector: Reflector,
  ) {}

  /** Só para testes: aplica outra matriz. */
  usarMatriz(matriz: Record<string, EntradaMatriz>) {
    this.matriz = matriz;
    return this;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const chave = chaveRotaPorHandler(context.getClass() as Type<unknown>, context.getHandler() as (...a: unknown[]) => unknown);
    const entrada = chave ? this.matriz[chave] : undefined;
    if (!entrada) negarAcesso();
    if (entrada.tipo === 'publico') return true;

    // Sessão (401 se ausente/inválida, como antes).
    await this.authGuard.canActivate(context);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (entrada.tipo === 'leitura-legada') {
      // Fase 1: leituras sem efeito mantêm a regra atual dos decoradores.
      if (!ehAdministradorSistema(user) && !this.passaDecoradoresLegados(context)) negarAcesso();
    } else {
      const resultado = avaliarEntrada(entrada, user);
      if (!resultado.permitido) negarAcesso();
    }
    request.matrizAutorizada = true;
    return true;
  }

  private passaDecoradoresLegados(context: ExecutionContext) {
    try {
      return new PermissionsGuard(this.reflector).canActivate(context) === true;
    } catch (err) {
      if (err instanceof ForbiddenException) return false;
      throw err;
    }
  }
}
