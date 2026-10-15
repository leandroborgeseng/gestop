import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { MENSAGEM_SEM_PERMISSAO } from '../auth/matriz/permissoes-matriz';
import { StorageAcessoService } from './storage-acesso.service';

function user(partial: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'u1',
    email: 'qa@aion.local',
    nome: 'QA',
    perfis: ['Consulta'],
    permissoes: [],
    secretariaId: 'sec-1',
    secretariasIds: ['sec-1'],
    acessoTodasSecretarias: false,
    ...partial,
  };
}

function prisma(dono: {
  evidencia?: unknown;
  anexoTarefa?: unknown;
  documento?: unknown;
  chamadoVisivel?: number;
}) {
  return {
    evidencia: { findFirst: vi.fn(async () => dono.evidencia ?? null) },
    chamadoTarefaAnexo: { findFirst: vi.fn(async () => dono.anexoTarefa ?? null) },
    documento: { findFirst: vi.fn(async () => dono.documento ?? null) },
    chamado: { count: vi.fn(async () => dono.chamadoVisivel ?? 0) },
  };
}

async function negado(p: Promise<unknown>) {
  await expect(p).rejects.toBeInstanceOf(ForbiddenException);
  await expect(p).rejects.toThrow(MENSAGEM_SEM_PERMISSAO);
}

const VER_CHAMADO = ['matriz.chamados._tela.visualizar'];

describe('285 — GET /storage confere permissão + escopo do registro dono', () => {
  it('evidência de chamado: exige permissão de ver chamados e o chamado no escopo', async () => {
    const svc = (db: ReturnType<typeof prisma>) => new StorageAcessoService(db as never);
    const key = 'evidencias/2026-10-01/a.jpg';

    await negado(svc(prisma({ evidencia: { chamadoId: 'c1' }, chamadoVisivel: 1 })).assertPodeBaixar(user(), key));
    await negado(
      svc(prisma({ evidencia: { chamadoId: 'c1' }, chamadoVisivel: 0 })).assertPodeBaixar(user({ permissoes: VER_CHAMADO }), key),
    );
    await expect(
      svc(prisma({ evidencia: { chamadoId: 'c1' }, chamadoVisivel: 1 })).assertPodeBaixar(user({ permissoes: VER_CHAMADO }), key),
    ).resolves.toBeUndefined();
  });

  it('anexo de tarefa: exige ver tarefas/chamados e o chamado da tarefa no escopo', async () => {
    const db = prisma({ anexoTarefa: { tarefa: { chamadoId: 'c2' } }, chamadoVisivel: 1 });
    const svc = new StorageAcessoService(db as never);
    await expect(svc.assertPodeBaixar(user({ permissoes: ['matriz.execucao.tarefas.visualizar'] }), 'tarefas/x.pdf')).resolves.toBeUndefined();
    await negado(svc.assertPodeBaixar(user({ permissoes: ['matriz.documentos._tela.visualizar'] }), 'tarefas/x.pdf'));
  });

  it('PDF de documento: exige ver documentos e a Secretaria do documento no escopo', async () => {
    const svc = new StorageAcessoService(prisma({ documento: { secretariaId: 'sec-2' } }) as never);
    const ver = { permissoes: ['matriz.documentos._tela.visualizar'] };
    await negado(svc.assertPodeBaixar(user(ver), 'documentos/d.pdf'));
    await expect(
      svc.assertPodeBaixar(user({ ...ver, secretariaId: 'sec-2', secretariasIds: ['sec-2'] }), 'documentos/d.pdf'),
    ).resolves.toBeUndefined();
  });

  it('evidência de vistoria fora da Secretaria → 403', async () => {
    const svc = new StorageAcessoService(prisma({ evidencia: { fiscalizacao: { secretariaId: 'sec-9' } } }) as never);
    await negado(svc.assertPodeBaixar(user({ permissoes: ['matriz.vistorias._tela.visualizar'] }), 'evidencias/v.jpg'));
  });

  it('arquivo sem registro dono e fora dos prefixos conhecidos → 403 (deny-by-default)', async () => {
    const svc = new StorageAcessoService(prisma({}) as never);
    await negado(svc.assertPodeBaixar(user({ permissoes: VER_CHAMADO }), 'outros/x.bin'));
  });

  it('Administrador (flag) baixa sem consultar dono; sem sessão → 403', async () => {
    const db = prisma({});
    const svc = new StorageAcessoService(db as never);
    await expect(svc.assertPodeBaixar(user({ administradorSistema: true }), 'outros/x.bin')).resolves.toBeUndefined();
    expect(db.evidencia.findFirst).not.toHaveBeenCalled();
    await negado(svc.assertPodeBaixar(undefined, 'outros/x.bin'));
  });
});
