import { UnauthorizedException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { verifyJwt, type JwtPayload } from './jwt';
import { hashPassword } from './password';
import { hashDoToken } from './session-duration';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const DIA = 60 * 60 * 24;
const SENHA = 'Zzteste322!Aa';

const usuario = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'ZZ Teste',
  email: 'zzteste-refresh@aion.local',
  senhaHash: hashPassword(SENHA, 'salt-refresh'),
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

type LinhaAuditoria = {
  acao: AuditAction;
  entidadeTipo: string;
  entidadeId: string | null;
  usuarioId: string;
};

function montar(auditoria: LinhaAuditoria[]) {
  const prisma = {
    usuario: {
      findUnique: vi.fn(async () => usuario),
      update: vi.fn(async () => usuario),
    },
    logAuditoria: {
      findFirst: vi.fn(async (args: { where: { acao: AuditAction; entidadeTipo?: string; entidadeId?: string; usuarioId?: string; createdAt?: unknown } }) => {
        return (
          auditoria.find(
            (row) =>
              row.acao === args.where.acao &&
              row.entidadeTipo === args.where.entidadeTipo &&
              row.entidadeId === args.where.entidadeId,
          ) ?? null
        );
      }),
    },
  };
  const audit = {
    record: vi.fn(async (input: { user: JwtPayload; acao: AuditAction; entidadeTipo: string; entidadeId?: string | null }) => {
      auditoria.push({
        acao: input.acao,
        entidadeTipo: input.entidadeTipo,
        entidadeId: input.entidadeId ?? null,
        usuarioId: input.user.sub,
      });
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
  it('logout no celular revoga só essa sessão; o desktop continua renovando', async () => {
    const auditoria: LinhaAuditoria[] = [];
    const { service, prisma } = montar(auditoria);

    const celular = await service.login(usuario.email, SENHA, true);
    const desktop = await service.login(usuario.email, SENHA, true);
    const claimsCelular = verifyJwt(celular.accessToken, SEGREDO);
    const claimsDesktop = verifyJwt(desktop.accessToken, SEGREDO);

    expect(claimsCelular.sid).toBeTruthy();
    expect(claimsDesktop.sid).toBeTruthy();
    expect(claimsCelular.sid).not.toBe(claimsDesktop.sid);
    expect(claimsCelular.jti).not.toBe(claimsDesktop.jti);
    expect(claimsCelular.auth_time).toBeTypeOf('number');

    await service.logout(claimsCelular, undefined, celular.accessToken);
    await expect(service.refreshSession(claimsCelular, celular.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);

    const renovado = await service.refreshSession(claimsDesktop, desktop.accessToken);
    const emitido = verifyJwt(renovado.accessToken, SEGREDO);
    expect(emitido.sid).toBe(claimsDesktop.sid);
    expect(emitido.auth_time).toBe(claimsDesktop.auth_time);
    expect(emitido.jti).not.toBe(claimsDesktop.jti);

    for (const [args] of prisma.logAuditoria.findFirst.mock.calls) {
      expect(args.where.usuarioId).toBeUndefined();
      expect(args.where.createdAt).toBeUndefined();
      expect(args.where.entidadeTipo).toBe('sessao');
    }
  });

  it('token legado sem auth_time nem sid renova com teto a partir do iat e ganha sid', async () => {
    const agora = Math.floor(Date.now() / 1000);
    const { service } = montar([]);
    const iat = agora - 10 * DIA;
    const atual = token({ iat, exp: iat + 30 * DIA });

    const renovado = await service.refreshSession(atual, 'token-legado-sem-sid');
    const emitido = verifyJwt(renovado.accessToken, SEGREDO);

    expect(atual.auth_time).toBeUndefined();
    expect(atual.sid).toBeUndefined();
    expect(emitido.auth_time).toBe(iat);
    expect(emitido.sid).toBeTruthy();
    expect(emitido.jti).toBeTruthy();
    expect(emitido.exp! - emitido.iat!).toBe(20 * DIA);
    expect(emitido.exp!).toBeLessThanOrEqual(iat + 30 * DIA);
  });

  it('token legado com iat há mais de 30 dias não renova', async () => {
    const agora = Math.floor(Date.now() / 1000);
    const { service, prisma } = montar([]);
    const atual = token({ iat: agora - 30 * DIA - 5, exp: agora + 3600 });

    await expect(service.refreshSession(atual, 'token-legado-velho')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
  });

  it('logout de token legado revoga só aquele token, pelo hash', async () => {
    const agora = Math.floor(Date.now() / 1000);
    const auditoria: LinhaAuditoria[] = [];
    const { service } = montar(auditoria);
    const legado = token({ iat: agora - 60, exp: agora - 60 + 30 * DIA });
    const celular = 'legado-celular';
    const desktop = 'legado-desktop';

    await service.logout(legado, undefined, celular);

    expect(auditoria.some((row) => row.acao === AuditAction.LOGOUT && row.entidadeId === hashDoToken(celular))).toBe(true);
    await expect(service.refreshSession(legado, celular)).rejects.toBeInstanceOf(UnauthorizedException);

    const renovado = await service.refreshSession(legado, desktop);
    const emitido = verifyJwt(renovado.accessToken, SEGREDO);
    expect(emitido.sid).toBeTruthy();
    expect(emitido.auth_time).toBe(legado.iat);
    expect(auditoria.some((row) => row.entidadeId === hashDoToken(desktop))).toBe(false);
  });

  it('não emite token que passe de 30 dias do login original', async () => {
    const agora = Math.floor(Date.now() / 1000);
    const { service } = montar([]);
    const authTime = agora - 20 * DIA;
    const atual = token({ iat: agora - DIA, exp: agora - DIA + 30 * DIA, auth_time: authTime, sid: 'sessao-desktop' });

    const renovado = await service.refreshSession(atual);
    const emitido = verifyJwt(renovado.accessToken, SEGREDO);

    expect(emitido.auth_time).toBe(authTime);
    expect(emitido.sid).toBe('sessao-desktop');
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
      sid: 'sessao-estourada',
    });

    await expect(service.refreshSession(atual)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
  });

  it('a sessão curta continua renovando por 8 horas', async () => {
    const agora = Math.floor(Date.now() / 1000);
    const { service } = montar([]);
    const atual = token({ iat: agora - 60, exp: agora - 60 + 8 * 60 * 60, auth_time: agora - 60, sid: 'sessao-curta' });

    const renovado = await service.refreshSession(atual);
    const emitido = verifyJwt(renovado.accessToken, SEGREDO);
    expect(emitido.exp! - emitido.iat!).toBe(8 * 60 * 60);
    expect(emitido.sid).toBe('sessao-curta');
  });
});
