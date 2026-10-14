import 'reflect-metadata';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module';
import { AuthService } from '../auth.service';
import type { AuthGuard } from '../auth.guard';
import type { JwtPayload } from '../jwt';
import { GlobalHttpExceptionFilter } from '../../common/http-exception.filter';
import { PERMISSION_ACTIONS, listCatalogMatrixKeys } from '../../domain/permissions-catalog';
import { resolveEffectiveMatrixKeys } from '../../domain/permissions-matrix';
import { MatrizPermissoesGuard } from './matriz-permissoes.guard';
import { MENSAGEM_SEM_PERMISSAO, PERMISSOES_MATRIZ, type EntradaMatriz, type RegraPermissao } from './permissoes-matriz';
import { descobrirRotas, type RotaDescoberta } from './rotas-descoberta';

/**
 * 285 (b): teste dirigido pela matriz. Para CADA entrada `permissao`, roda o guard global
 * real com 4 usuários montados pelo cálculo real de sessão do AuthService:
 * só-visualizar, perfil INATIVO com a permissão, permissão DIRETA e Administrador (flag).
 */

const SECRETARIA = { id: 'sec-1', nome: 'Secretaria 1', sigla: 'S1' };

type PerfilFixture = { id: string; nome: string; ativo: boolean; administradorSistema?: boolean; chaves: string[] };

function sessao(opts: { perfilAtivo: PerfilFixture; outros?: PerfilFixture[]; diretas?: string[]; semSecretaria?: boolean }): JwtPayload {
  const perfis = [opts.perfilAtivo, ...(opts.outros ?? [])].map((p) => ({
    perfilId: p.id,
    perfil: {
      id: p.id,
      nome: p.nome,
      ativo: p.ativo,
      administradorSistema: p.administradorSistema ?? false,
      natureza: 'INTERNO' as const,
      permissoes: p.chaves.map((chave) => ({ permissao: { chave } })),
    },
  }));
  const usuario = {
    id: 'u-1',
    nome: 'Usuário',
    email: 'qa@aion.local',
    secretariaId: opts.semSecretaria ? null : SECRETARIA.id,
    perfilAtivoId: opts.perfilAtivo.id,
    secretariaAtivaId: opts.semSecretaria ? null : SECRETARIA.id,
    acessoTodasSecretarias: false,
    secretaria: opts.semSecretaria ? null : SECRETARIA,
    secretariaAtiva: opts.semSecretaria ? null : SECRETARIA,
    perfilAtivo: { ...perfis[0].perfil },
    perfis,
    permissoesIndividuais: (opts.diretas ?? []).map((chave) => ({ permissao: { chave } })),
    secretariasVinculos: opts.semSecretaria ? [] : [{ secretariaId: SECRETARIA.id, principal: true, secretaria: SECRETARIA }],
  };
  const svc = Object.create(AuthService.prototype) as { buildSessionPayload: (u: typeof usuario) => Record<string, unknown> };
  const s = svc.buildSessionPayload(usuario) as {
    perfis: string[];
    permissoes: string[];
    secretariaId: string | null;
    acessoTodasSecretarias: boolean;
    secretariasDisponiveis: Array<{ id: string }>;
    administradorSistema: boolean;
  };
  return {
    sub: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    perfis: s.perfis,
    permissoes: s.permissoes,
    secretariaId: s.secretariaId,
    acessoTodasSecretarias: s.acessoTodasSecretarias,
    secretariasIds: s.secretariasDisponiveis.map((x) => x.id),
    administradorSistema: s.administradorSistema,
  };
}

const VAZIO: PerfilFixture = { id: 'p-vazio', nome: 'Sem permissões', ativo: true, chaves: [] };
const SO_VISUALIZAR: PerfilFixture = {
  id: 'p-ver',
  nome: 'Consulta',
  ativo: true,
  chaves: listCatalogMatrixKeys().filter((k) => k.endsWith('.visualizar')),
};
const ADMIN: PerfilFixture = { id: 'p-admin', nome: 'Qualquer nome', ativo: true, administradorSistema: true, chaves: [] };

function usuarios(regra: RegraPermissao) {
  const chave = regra.chaves[0];
  return {
    soVisualizar: sessao({ perfilAtivo: SO_VISUALIZAR }),
    perfilInativo: sessao({ perfilAtivo: VAZIO, outros: [{ id: 'p-inativo', nome: 'Inativo', ativo: false, chaves: [chave] }] }),
    direta: sessao({ perfilAtivo: VAZIO, diretas: [chave] }),
    diretaSemSecretaria: sessao({ perfilAtivo: VAZIO, diretas: [chave], semSecretaria: true }),
    admin: sessao({ perfilAtivo: ADMIN }),
  };
}

function criarGuard(user: JwtPayload | undefined, matriz?: Record<string, EntradaMatriz>) {
  const authGuard = {
    canActivate: vi.fn(async (ctx: ExecutionContext) => {
      const req = ctx.switchToHttp().getRequest<{ user?: JwtPayload; sessaoResolvida?: boolean }>();
      req.user = user;
      req.sessaoResolvida = true;
      return true;
    }),
  } as unknown as AuthGuard;
  const guard = new MatrizPermissoesGuard(authGuard, new Reflector());
  return matriz ? guard.usarMatriz(matriz) : guard;
}

function contexto(rota: RotaDescoberta) {
  const request: Record<string, unknown> = { headers: {}, method: rota.metodo, url: rota.caminho };
  return {
    request,
    ctx: {
      getType: () => 'http',
      getClass: () => rota.controller,
      getHandler: () => rota.handler,
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
    } as unknown as ExecutionContext,
  };
}

/** Simula o pipeline do Nest: guard → handler (que grava). Devolve se gravou e o erro. */
async function executar(rota: RotaDescoberta, user: JwtPayload | undefined, matriz?: Record<string, EntradaMatriz>) {
  const gravar = vi.fn();
  const { ctx } = contexto(rota);
  try {
    await criarGuard(user, matriz).canActivate(ctx);
    gravar();
    return { gravou: gravar.mock.calls.length > 0, erro: null as unknown };
  } catch (erro) {
    return { gravou: gravar.mock.calls.length > 0, erro };
  }
}

function corpoDoFiltro(erro: unknown) {
  let corpo: { statusCode?: number; message?: string } = {};
  const response = { status: () => response, json: (b: typeof corpo) => (corpo = b) };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ method: 'POST', url: '/x' }) }),
  };
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  new GlobalHttpExceptionFilter().catch(erro, host as never);
  return corpo;
}

function expectNegado(r: { gravou: boolean; erro: unknown }, rotulo: string) {
  expect(r.erro, rotulo).toBeInstanceOf(ForbiddenException);
  expect(r.gravou, `${rotulo}: não pode persistir`).toBe(false);
  const corpo = corpoDoFiltro(r.erro);
  expect(corpo.statusCode, rotulo).toBe(403);
  expect(corpo.message, rotulo).toBe(MENSAGEM_SEM_PERMISSAO);
}

function expectPermitido(r: { gravou: boolean; erro: unknown }, rotulo: string) {
  expect(r.erro, rotulo).toBeNull();
  expect(r.gravou, rotulo).toBe(true);
}

describe('285 — guard global da matriz (dirigido pela matriz)', () => {
  let rotas: RotaDescoberta[];
  let porChave: Map<string, RotaDescoberta>;

  beforeAll(async () => {
    rotas = await descobrirRotas(AppModule);
    porChave = new Map(rotas.map((r) => [r.chave, r]));
  });

  it('cada entrada `permissao`: só-visualizar, perfil inativo, permissão direta, Admin e escopo de Secretaria', async () => {
    const regras = Object.entries(PERMISSOES_MATRIZ).filter((e): e is [string, RegraPermissao] => e[1].tipo === 'permissao');
    expect(regras.length).toBeGreaterThan(100);
    for (const [chave, regra] of regras) {
      const rota = porChave.get(chave);
      expect(rota, chave).toBeDefined();
      const u = usuarios(regra);

      const ver = await executar(rota!, u.soVisualizar);
      if (regra.acao === 'visualizar') expectPermitido(ver, `${chave} só-visualizar`);
      else expectNegado(ver, `${chave} só-visualizar`);

      expectNegado(await executar(rota!, u.perfilInativo), `${chave} perfil inativo`);
      expectPermitido(await executar(rota!, u.direta), `${chave} permissão direta`);
      expectPermitido(await executar(rota!, u.admin), `${chave} admin`);

      const fora = await executar(rota!, u.diretaSemSecretaria);
      if (regra.escopo === 'secretaria-ativa') expectNegado(fora, `${chave} sem Secretaria no escopo`);
      else expectPermitido(fora, `${chave} escopo nenhum`);
    }
  });

  it('cada chave alternativa da entrada autoriza sozinha (e nenhuma outra ação da mesma rotina)', async () => {
    for (const [chave, regra] of Object.entries(PERMISSOES_MATRIZ)) {
      if (regra.tipo !== 'permissao') continue;
      const rota = porChave.get(chave)!;
      for (const alternativa of regra.chaves) {
        expectPermitido(await executar(rota, sessao({ perfilAtivo: VAZIO, diretas: [alternativa] })), `${chave} via ${alternativa}`);
      }
      const [tela, funcao] = regra.rotina.split('.');
      const outras = PERMISSION_ACTIONS.filter((a) => a !== regra.acao)
        .map((a) => `matriz.${tela}.${funcao}.${a}`)
        .filter((k) => !regra.chaves.includes(k))
        // Compatibilidade documentada (269): tarefas.excluir ⇒ tarefas_cancelar.executar.
        .filter((k) => ![...resolveEffectiveMatrixKeys([k])].some((e) => regra.chaves.includes(e)));
      if (outras.length === 0) continue;
      expectNegado(await executar(rota, sessao({ perfilAtivo: VAZIO, diretas: outras })), `${chave} com outras ações`);
    }
  });

  it('nome "Administrador do Sistema" sem o flag não concede exceção', async () => {
    const rota = porChave.get('POST /chamados')!;
    const soNome = sessao({ perfilAtivo: { id: 'p', nome: 'Administrador do Sistema', ativo: true, chaves: [] } });
    expectNegado(await executar(rota, soNome), 'nome sem flag');
  });

  it('perfil ativo marcado como Admin, mas INATIVO, não concede exceção', async () => {
    const rota = porChave.get('POST /chamados')!;
    const inativo = sessao({
      perfilAtivo: VAZIO,
      outros: [{ id: 'p-adm', nome: 'Adm', ativo: false, administradorSistema: true, chaves: [] }],
    });
    expect(inativo.administradorSistema).toBe(false);
    expectNegado(await executar(rota, inativo), 'admin inativo');
  });

  it('deny-by-default: rota sem entrada na matriz → 403 com a mensagem exata, sem gravar', async () => {
    const rota = porChave.get('POST /chamados')!;
    const { ['POST /chamados']: _removida, ...semEntrada } = PERMISSOES_MATRIZ;
    expectNegado(await executar(rota, sessao({ perfilAtivo: ADMIN }), semEntrada), 'sem entrada (até admin)');
  });

  it('rotas públicas não exigem sessão; rotas de sessão exigem usuário', async () => {
    expectPermitido(await executar(porChave.get('POST /auth/login')!, undefined), 'login');
    expectPermitido(await executar(porChave.get('GET /health')!, undefined), 'health');
    expectPermitido(await executar(porChave.get('POST /auth/logout')!, sessao({ perfilAtivo: VAZIO })), 'logout');
  });

  it('leitura legada mantém a regra dos decoradores e responde 403 com a mensagem exata', async () => {
    const rota = porChave.get('GET /chamados')!;
    expectNegado(await executar(rota, sessao({ perfilAtivo: VAZIO })), 'GET /chamados sem permissão');
    expectPermitido(
      await executar(rota, sessao({ perfilAtivo: VAZIO, diretas: ['matriz.chamados.triagem.alterar'] })),
      'GET /chamados com permissão de chamados',
    );
    expectPermitido(await executar(rota, sessao({ perfilAtivo: ADMIN })), 'GET /chamados admin');
  });

  it('marca a requisição como autorizada para o PermissionsGuard legado não decidir de novo', async () => {
    const rota = porChave.get('POST /chamados')!;
    const { ctx, request } = contexto(rota);
    await criarGuard(sessao({ perfilAtivo: VAZIO, diretas: ['matriz.chamados.abrir_chamado.inserir'] })).canActivate(ctx);
    expect(request.matrizAutorizada).toBe(true);
  });

  it('tarefas: tratar pela Execução usa a rotina de tarefas; chamados.executar legado só vale pela expansão', async () => {
    const rota = porChave.get('PATCH /chamado-tarefas/:id')!;
    expectPermitido(await executar(rota, sessao({ perfilAtivo: VAZIO, diretas: ['matriz.execucao.tarefas.executar'] })), 'execução');
    expectPermitido(await executar(rota, sessao({ perfilAtivo: VAZIO, diretas: ['chamados.executar'] })), 'legado expandido');
    expectNegado(
      await executar(rota, sessao({ perfilAtivo: VAZIO, diretas: ['matriz.chamados.abrir_chamado.inserir'] })),
      'outra função de chamados',
    );
  });
});
