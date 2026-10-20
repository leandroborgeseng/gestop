import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { REQUIRED_ANY_PERMISSIONS_KEY } from '../auth/permissions';
import { adminTabPermissionKeys } from '../domain/admin-permissions';
import { WebmapCamadasAdminController, WebmapCamadasMapaController } from './webmap-camadas.controller';
import { WebmapCamadasService } from './webmap-camadas.service';

const perms = (fn: unknown) => Reflect.getMetadata(REQUIRED_ANY_PERMISSIONS_KEY, fn as object) as string[];

describe('296 — permissões e concorrência', () => {
  it('simular/aplicar/CSV exigem importacao.executar; status/histórico exigem importacao.visualizar (mesmas da tela)', () => {
    const p = WebmapCamadasAdminController.prototype;
    for (const m of [p.simular, p.aplicar, p.errosCsv]) expect(perms(m)).toEqual(adminTabPermissionKeys('importacao', 'executar'));
    for (const m of [p.status, p.historico]) expect(perms(m)).toEqual(adminTabPermissionKeys('importacao', 'visualizar'));
  });

  it('camadas do mapa exigem leitura operacional (CCO)', () => {
    expect(perms(WebmapCamadasMapaController)?.length).toBeGreaterThan(0);
  });

  it('segunda execução simultânea recebe aviso com quem e desde quando', async () => {
    let soltar!: () => void;
    const fonte = { descricao: 'fake', listar: () => new Promise<never>((_, rej) => (soltar = () => rej(new Error('x')))), lerTexto: async () => '', lerBinario: async () => Buffer.alloc(0) };
    const prisma = { logAuditoria: { create: async () => ({}) } };
    const s = new WebmapCamadasService(prisma as never, {} as never);
    s.usarFonte(fonte as never);
    const user = { sub: 'u1', nome: 'Ana Admin', email: '', perfis: [], permissoes: [] };
    const primeira = s.simular(user).catch(() => undefined);
    await expect(s.simular({ ...user, nome: 'Outro' })).rejects.toThrow(ConflictException);
    await expect(s.simular(user)).rejects.toThrow(/em andamento por Ana Admin desde .*\(BRT\)/);
    soltar();
    await primeira;
  });

  it('aplicar sem simulação é recusado', async () => {
    const s = new WebmapCamadasService({} as never, {} as never);
    await expect(s.aplicar({ sub: 'u', nome: 'n', email: '', perfis: [], permissoes: [] }, 'nao-existe')).rejects.toThrow(/Simule/);
  });
});
