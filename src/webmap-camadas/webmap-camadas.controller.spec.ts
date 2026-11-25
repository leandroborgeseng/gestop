import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_ANY_PERMISSIONS_KEY } from '../auth/permissions';
import { adminTabPermissionKeys } from '../domain/admin-permissions';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../auth/permissions.guard';
import { WebmapCamadasAdminController, WebmapCamadasMapaController, WEBMAP_MAPA_KEYS } from './webmap-camadas.controller';
import { WebmapCamadasService } from './webmap-camadas.service';

const perms = (fn: unknown) => Reflect.getMetadata(REQUIRED_ANY_PERMISSIONS_KEY, fn as object) as string[];

describe('296 — permissões e concorrência', () => {
  it('simular/aplicar/CSV exigem importacao.executar; status/histórico exigem importacao.visualizar (mesmas da tela)', () => {
    const p = WebmapCamadasAdminController.prototype;
    for (const m of [p.simular, p.aplicar, p.errosCsv]) expect(perms(m)).toEqual(adminTabPermissionKeys('importacao', 'executar'));
    for (const m of [p.status, p.historico]) expect(perms(m)).toEqual(adminTabPermissionKeys('importacao', 'visualizar'));
  });

  it('300 (QA2): camadas do mapa usam a mesma chave da tela do CCO (dashboard.visualizar)', () => {
    expect(perms(WebmapCamadasMapaController)).toEqual(['dashboard.visualizar']);
    expect(WEBMAP_MAPA_KEYS).toEqual(perms(WebmapCamadasMapaController));
  });

  describe('300 W4: guard real nas rotas do mapa (lista, geojson, status)', () => {
    const guard = new PermissionsGuard(new Reflector());
    const p = WebmapCamadasMapaController.prototype;
    const ctx = (handler: unknown, permissoes: string[], perfis = ['TESTE']) => ({
      getHandler: () => handler, getClass: () => WebmapCamadasMapaController,
      switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'u', nome: 't', email: 't@aion.local', perfis, permissoes } }) }),
    }) as unknown as ExecutionContext;
    const rotas = [p.arvore, p.geojson, p.status];
    // Perfil "Gestor CCO" do seed: todas as chaves legadas menos usuarios.gerenciar, nenhuma matriz.*
    const GESTOR_CCO_LEGADO = ['unidades.gerenciar', 'chamados.gerenciar', 'chamados.abrir', 'chamados.executar', 'meus_chamados.visualizar', 'fiscalizacoes.executar', 'checklists.gerenciar', 'documentos.visualizar', 'dashboard.visualizar', 'auditoria.visualizar'];
    it('Gestor CCO (só legado) é aceito', () => {
      for (const h of rotas) expect(guard.canActivate(ctx(h, GESTOR_CCO_LEGADO, ['Gestor CCO']))).toBe(true);
    });
    it('perfil da matriz com CCO (tela ou mapa) é aceito', () => {
      for (const h of rotas) {
        expect(guard.canActivate(ctx(h, ['matriz.cco._tela.visualizar']))).toBe(true);
        expect(guard.canActivate(ctx(h, ['matriz.cco.mapa.visualizar']))).toBe(true);
      }
    });
    it('perfil só Documentos recebe 403 (matriz e legado documentos.visualizar)', () => {
      for (const h of rotas) {
        expect(() => guard.canActivate(ctx(h, ['matriz.documentos._tela.visualizar', 'matriz.documentos.consultar.visualizar', 'documentos.visualizar']))).toThrow(ForbiddenException);
      }
    });
    it('perfil só Cronograma: ACEITO (matriz.cronograma deriva dashboard.visualizar, a mesma chave que abre o CCO)', () => {
      for (const h of rotas) expect(guard.canActivate(ctx(h, ['matriz.cronograma._tela.visualizar']))).toBe(true);
    });
    it('sem nenhuma chave operacional (só abrir chamado) recebe 403', () => {
      for (const h of rotas) expect(() => guard.canActivate(ctx(h, ['chamados.abrir', 'meus_chamados.visualizar']))).toThrow(ForbiddenException);
    });
  });

  it('segunda execução simultânea recebe aviso com quem e desde quando', async () => {
    let soltar!: () => void;
    const fonte = { descricao: 'fake', listar: () => new Promise<never>((_, rej) => (soltar = () => rej(new Error('x')))), lerTexto: async () => '', lerBinario: async () => Buffer.alloc(0) };
    const prisma = { logAuditoria: { create: async () => ({}) }, webmapImportacao: { findFirst: async () => null } };
    const s = new WebmapCamadasService(prisma as never, {} as never);
    s.usarFonte(fonte as never);
    const user = { sub: 'u1', nome: 'Ana Admin', email: '', perfis: [], permissoes: [] };
    const primeira = s.simular(user).catch(() => undefined);
    await vi.waitFor(() => expect(soltar).toBeTypeOf('function')); // 296-ALTO: simular roda a recuperação antes de ler a fonte
    await expect(s.simular({ ...user, nome: 'Outro' })).rejects.toThrow(ConflictException);
    await expect(s.simular(user)).rejects.toThrow(/em andamento por Ana Admin desde .*\(BRT\)/);
    soltar();
    await primeira;
  });

  it('visibilidade: status do mapa (sem permissão de Importação) só diz "Importação em andamento"; o do Admin traz fase, quem e desde quando', async () => {
    const job = { id: 'j1', status: 'EM_ANDAMENTO', fase: 'gravando', usuarioNome: 'Ana Admin', iniciadoEm: new Date('2026-10-20T15:40:00Z'), concluidoEm: null, motivo: null, resultado: null };
    const prisma = {
      webmapImportacao: { findFirst: async () => job },
      logAuditoria: { findMany: async () => [] },
      webmapCamada: { count: async () => 0 },
    };
    const s = new WebmapCamadasService(prisma as never, {} as never);
    const publico = await s.statusPublico();
    expect(publico).toEqual({ emAndamento: true, mensagem: 'Importação em andamento' });
    expect(JSON.stringify(publico)).not.toMatch(/Ana|gravando|2026/);
    const admin = await s.status();
    expect(admin.emAndamento).toMatchObject({ usuario: 'Ana Admin', fase: 'gravando', desdeBrt: '20/10/2026 12:40:00 (BRT)' });
    const p = WebmapCamadasAdminController.prototype;
    expect(perms(p.status)).toEqual(adminTabPermissionKeys('importacao', 'visualizar'));
    expect(perms(WebmapCamadasMapaController)).not.toEqual(adminTabPermissionKeys('importacao', 'visualizar'));
  });

  it('aplicar sem simulação é recusado', async () => {
    const s = new WebmapCamadasService({} as never, {} as never);
    await expect(s.aplicar({ sub: 'u', nome: 'n', email: '', perfis: [], permissoes: [] }, 'nao-existe')).rejects.toThrow(/Simule/);
  });
});
