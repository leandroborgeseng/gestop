import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForbiddenException } from '@nestjs/common';
import { ChamadoStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ChamadosController } from './chamados.controller';
import { ChamadosService } from './chamados.service';
import { ChamadoTarefasController } from './chamado-tarefas.controller';
import { ChamadoTarefasService } from './chamado-tarefas.service';

function userResponsavelTarefa(): JwtPayload {
  return {
    sub: 'user-resp',
    email: 'resp@test.com',
    nome: 'Responsável da tarefa',
    perfis: [],
    permissoes: [],
    acessoTodasSecretarias: false,
    secretariaId: 'sec-outra',
    perfilAtivoId: null,
  };
}

function chamadoForaDoEscopo() {
  return {
    id: 'chamado-1',
    secretariaId: 'sec-1',
    status: ChamadoStatus.ABERTO,
    excluidoEm: null,
    equipeId: 'eq-1',
    unidade: { secretariaId: 'sec-1' },
    equipe: { secretariaId: 'sec-1' },
    observadores: [],
    evidencias: [],
  };
}

describe('gestão real do chamado permanece fechada para o usuário da tarefa', () => {
  const prisma = {
    chamado: { findUnique: vi.fn(), update: vi.fn() },
    historicoStatus: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    evidencia: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
    equipeUsuario: { findMany: vi.fn() },
    logAuditoria: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const storage = {
    persistAberturaAnexo: vi.fn(),
    persistEvidenceUrl: vi.fn(),
    deleteStoredObject: vi.fn(),
  };
  let service: ChamadosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChamadosService(prisma as never, {} as never, storage as never, {} as never, {} as never);
    prisma.chamado.findUnique.mockResolvedValue(chamadoForaDoEscopo());
    prisma.historicoStatus.findMany.mockResolvedValue([]);
    prisma.historicoStatus.create.mockResolvedValue({ id: 'h-1' });
    prisma.evidencia.findMany.mockResolvedValue([]);
  });

  it('não registrou rotas falsas de recusa em chamado-tarefas', () => {
    expect(ChamadoTarefasController.prototype).not.toHaveProperty('recusarHistoricoChamado');
    expect(ChamadoTarefasController.prototype).not.toHaveProperty('recusarStatusChamado');
    expect(ChamadoTarefasController.prototype).not.toHaveProperty('recusarAnexoChamado');
    expect(ChamadoTarefasController.prototype).not.toHaveProperty('recusarExcluirAnexoChamado');
    expect(ChamadoTarefasController.prototype).not.toHaveProperty('recusarEncerrarChamado');
    expect(ChamadoTarefasService.prototype).not.toHaveProperty('recusarGestaoChamadoViaTarefa');

    const src = readFileSync(join(__dirname, 'chamado-tarefas.controller.ts'), 'utf8');
    expect(src).toContain("@Get(':id/chamado/:chamadoId')");
    expect(src).not.toMatch(/@(Post|Put|Patch|Delete)\(':id\/chamado\/:chamadoId/i);
    expect(src).not.toContain('recusarGestaoChamadoViaTarefa');
  });

  it('rotas reais de gestão do chamado continuam exigindo permissão de chamado', () => {
    const src = readFileSync(join(__dirname, 'chamados.controller.ts'), 'utf8');
    expect(src).toMatch(/@RequirePermissions\('chamados\.gerenciar'\)\s+@Post\(':id\/historico'\)/);
    expect(src).toMatch(/@RequirePermissions\('chamados\.gerenciar'\)\s+@Put\(':id\/status'\)/);
    expect(src).toMatch(
      /@RequireAnyPermissions\('chamados\.gerenciar', 'chamados\.executar'\)\s+@Post\(':id\/execucao\/evidencias'\)/,
    );
    expect(src).toMatch(
      /@RequireAnyPermissions\('chamados\.gerenciar', 'chamados\.executar'\)\s+@Delete\(':id\/execucao\/evidencias\/:evidenciaId'\)/,
    );
    expect(src).toMatch(/@RequirePermissions\(CHAMADO_EXCLUIR_LOGICAMENTE\)\s+@Post\(':id\/exclusao-logica'\)/);
  });

  it('PermissionsGuard recusa o usuário da tarefa nas rotas de gestão do chamado', () => {
    const reflector = {
      getAllAndOverride: vi.fn((_key: string) => ['chamados.gerenciar']),
    };
    const guard = new PermissionsGuard(reflector as never);
    const context = {
      getHandler: () => ChamadosController.prototype.registrarHistorico,
      getClass: () => ChamadosController,
      switchToHttp: () => ({ getRequest: () => ({ user: userResponsavelTarefa() }) }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it('usuário da tarefa sem acesso ao chamado não registra histórico', async () => {
    await expect(
      service.registrarHistorico('chamado-1', { descricao: 'Comentário indevido' }, userResponsavelTarefa()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.historicoStatus.create).not.toHaveBeenCalled();
  });

  it('usuário da tarefa sem acesso ao chamado não muda status', async () => {
    await expect(
      service.updateStatus('chamado-1', { status: ChamadoStatus.CANCELADO, motivo: 'encerrar' }, userResponsavelTarefa()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('usuário da tarefa sem acesso ao chamado não anexa evidência de execução', async () => {
    await expect(
      service.adicionarEvidenciaExecucao(
        'chamado-1',
        {
          url: 'data:image/jpeg;base64,abc',
          localizacao: { latitude: 1, longitude: 1 },
          capturadaEm: new Date().toISOString(),
        } as never,
        userResponsavelTarefa(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(storage.persistEvidenceUrl).not.toHaveBeenCalled();
  });

  it('usuário da tarefa sem acesso ao chamado não exclui anexo de execução', async () => {
    await expect(
      service.removerEvidenciaExecucao('chamado-1', 'ev-1', userResponsavelTarefa()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.evidencia.delete).not.toHaveBeenCalled();
  });

  it('usuário da tarefa sem acesso ao chamado não encerra o chamado', async () => {
    await expect(
      service.excluirLogicamente('chamado-1', 'justificativa de exclusão com texto', userResponsavelTarefa()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
