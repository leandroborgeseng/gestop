import { UnauthorizedException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { verifyJwt, type JwtPayload } from './jwt';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const DIA = 60 * 60 * 24;

const usuario = {
  id: 'u-refresh',
  nome: 'ZZ Teste',
  email: 'zzteste-refresh@aion.local',
  senhaHash: 'x',
  ativo: true,
  secretariaId: null,
  perfilAtivoId: null,
  secretariaAtivaId: null,
  acessoTodasSecretarias: false,
  secretaria: null,
  secretariaAtiva: null,
  perfilAtivo: null,
  perfis: [],
  permissoesIndividuais: [],
  secretariasVinculos: [],
};

function montar(auditoria: Array<{ acao: AuditAction; createdAt: Date; usuarioId: string }>) {
  const prisma = {
    usuario: { findUnique: vi.fn(async () => usuario) },
    logAuditoria: {
      findFirst: vi.fn(async (args: { where: { usuarioId: string; acao: AuditAction; createdAt?: { gt: Date } } }) => {
        const limite = args.where.createdAt?.gt?.getTime() ?? 0;
        return (
          auditoria.find(
            (row) => row.usuarioId === args.where.usuarioId && row.acao === args.where.acao && row.createdAt.getTime() > limite,
          ) ?? null
        );
      }),
    },
  };
  const audit = {
    record: vi.fn(async (input: { user: JwtPayload; acao: AuditAction }) => {
      auditoria.push({ acao: input.acao, createdAt: new Date(), usuarioId: input.user.sub });
    }),
  };
  const service = new AuthService(
    prisma as never,
    { get: () => SEGREDO } as never,
    {} as never,
    audit as never,
  );
  return { service, prisma };
}

function token(parcial: Partial<JwtPayload> & { iat: number; exp: number }): JwtPayload {
  return {
    sub: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    perfis: [],
    permissoes: [],
    ...parcial,
  };
}

describe('POST /auth/refresh', () => {
  it('logout revoga o token e o refresh seguinte responde 401', async () => {
    const agora = Math.floor(Date.now() / 1000);
    const auditoria: Array<{ acao: AuditAction; createdAt: Date; usuarioId: string }> = [];
    const { service } = montar(auditoria);
    const atual = token({ iat: agora - 60, exp: agora - 60 + 30 * DIA, auth_time: agora - 2 * DIA });

    const renovado = await service.refreshSession(atual);
    expect(verifyJwt(renovado.accessToken, SEGREDO).sub).toBe(usuario.id);

    await service.logout(atual);
    await expect(service.refreshSession(atual)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('não emite token que passe de 30 dias do login original', async () => {
    const agora = Math.floor(Date.now() / 1000);
    const { service } = montar([]);
    const authTime = agora - 20 * DIA;
    const atual = token({ iat: agora - DIA, exp: agora - DIA + 30 * DIA, auth_time: authTime });

    const renovado = await service.refreshSession(atual);
    const emitido = verifyJwt(renovado.accessToken, SEGREDO);

    expect(emitido.auth_time).toBe(authTime);
    expect(emitido.exp! - emitido.iat!).toBe(10 * DIA);
    expect(emitido.exp!).toBeLessThanOrEqual(authTime + 30 * DIA);
  });

  it('depois do teto de 30 dias o refresh responde 401', async () => {
    const agora = Math.floor(Date.now() / 1000);
    const { service, prisma } = montar([]);
    const atual = token({
      iat: agora - 3600,
      exp: agora + 3600,
      auth_time: agora - 30 * DIA - 1,
    });

    await expect(service.refreshSession(atual)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
  });

  it('a sessão curta continua renovando por 8 horas', async () => {
    const agora = Math.floor(Date.now() / 1000);
    const { service } = montar([]);
    const atual = token({ iat: agora - 60, exp: agora - 60 + 8 * 60 * 60, auth_time: agora - 60 });

    const renovado = await service.refreshSession(atual);
    const emitido = verifyJwt(renovado.accessToken, SEGREDO);
    expect(emitido.exp! - emitido.iat!).toBe(8 * 60 * 60);
  });
});
