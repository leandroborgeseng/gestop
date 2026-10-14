import { describe, expect, it, vi } from 'vitest';
import { diaSaoPaulo, diaSaoPauloComoData, verificarAberturaDiaria, type UsuarioUpdateManyDelegate } from './abertura-diaria';

/** Fake fiel ao `updateMany` condicional: aplica o where sobre o estado em memória. */
function fakeUsuarios(estado: Map<string, Date | null>): UsuarioUpdateManyDelegate & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async updateMany({ where, data }) {
      calls.push(where);
      const id = where.id as string;
      const or = where.OR as Array<{ ultimaVerificacaoPendencias: null | { not: Date } }> | undefined;
      if (!estado.has(id)) return { count: 0 };
      const atual = estado.get(id) ?? null;
      const casa = !or
        ? true
        : or.some((c) =>
            c.ultimaVerificacaoPendencias === null
              ? atual === null
              : atual !== null && atual.getTime() !== c.ultimaVerificacaoPendencias.not.getTime(),
          );
      if (!casa) return { count: 0 };
      estado.set(id, data.ultimaVerificacaoPendencias);
      return { count: 1 };
    },
  };
}

const resumo = (total: number) => async () => ({ total, grupos: [] });
// Instantes em BRT (UTC-3)
const BRT = (iso: string) => new Date(`${iso}-03:00`);

describe('289 · dia em America/Sao_Paulo', () => {
  it('23:59 e 00:01 (BRT) são dias diferentes', () => {
    expect(diaSaoPaulo(BRT('2026-10-14T23:59:00'))).toBe('2026-10-14');
    expect(diaSaoPaulo(BRT('2026-10-15T00:01:00'))).toBe('2026-10-15');
  });

  it('21:30 BRT já é o dia seguinte em UTC, mas continua o mesmo dia para o servidor', () => {
    const t = BRT('2026-10-14T21:30:00');
    expect(t.toISOString().slice(0, 10)).toBe('2026-10-15');
    expect(diaSaoPaulo(t)).toBe('2026-10-14');
    expect(diaSaoPauloComoData(t).toISOString()).toBe('2026-10-14T00:00:00.000Z');
  });
});

describe('289 · verificarAberturaDiaria', () => {
  it('1ª verificação do dia com pendências: marca uma vez e abre', async () => {
    const estado = new Map<string, Date | null>([['u1', null]]);
    const r = await verificarAberturaDiaria({ usuarioId: 'u1', usuarios: fakeUsuarios(estado), calcular: resumo(3), agora: BRT('2026-10-14T08:00:00') });
    expect(r.abrir).toBe(true);
    expect(r.pendencias.total).toBe(3);
    expect(estado.get('u1')?.toISOString()).toBe('2026-10-14T00:00:00.000Z');
  });

  it('mesmo dia (outro login, refresh, volta do PWA): não abre de novo', async () => {
    const estado = new Map<string, Date | null>([['u1', null]]);
    const usuarios = fakeUsuarios(estado);
    await verificarAberturaDiaria({ usuarioId: 'u1', usuarios, calcular: resumo(3), agora: BRT('2026-10-14T08:00:00') });
    const r = await verificarAberturaDiaria({ usuarioId: 'u1', usuarios, calcular: resumo(3), agora: BRT('2026-10-14T21:30:00') });
    expect(r.abrir).toBe(false);
    expect(r.pendencias.total).toBe(3);
  });

  it('dia novo (sessão de 30 dias reaproveitada): abre de novo', async () => {
    const estado = new Map<string, Date | null>([['u1', diaSaoPauloComoData(BRT('2026-10-14T23:59:00'))]]);
    const r = await verificarAberturaDiaria({ usuarioId: 'u1', usuarios: fakeUsuarios(estado), calcular: resumo(1), agora: BRT('2026-10-15T00:01:00') });
    expect(r.abrir).toBe(true);
  });

  it('falha no cálculo: não marca nada e devolve o erro', async () => {
    const estado = new Map<string, Date | null>([['u1', null]]);
    const usuarios = fakeUsuarios(estado);
    const spy = vi.spyOn(usuarios, 'updateMany');
    await expect(
      verificarAberturaDiaria({ usuarioId: 'u1', usuarios, calcular: async () => { throw new Error('falha no cálculo'); } }),
    ).rejects.toThrow('falha no cálculo');
    expect(spy).not.toHaveBeenCalled();
    expect(estado.get('u1')).toBeNull();
  });

  it('zero pendências: marca o dia e não abre', async () => {
    const estado = new Map<string, Date | null>([['u1', null]]);
    const r = await verificarAberturaDiaria({ usuarioId: 'u1', usuarios: fakeUsuarios(estado), calcular: resumo(0), agora: BRT('2026-10-14T08:00:00') });
    expect(r.abrir).toBe(false);
    expect(estado.get('u1')?.toISOString()).toBe('2026-10-14T00:00:00.000Z');
  });

  it('dois usuários no mesmo navegador: cada um tem o seu dia', async () => {
    const estado = new Map<string, Date | null>([['u1', null], ['u2', null]]);
    const usuarios = fakeUsuarios(estado);
    const agora = BRT('2026-10-14T08:00:00');
    expect((await verificarAberturaDiaria({ usuarioId: 'u1', usuarios, calcular: resumo(2), agora })).abrir).toBe(true);
    expect((await verificarAberturaDiaria({ usuarioId: 'u2', usuarios, calcular: resumo(2), agora })).abrir).toBe(true);
    expect((await verificarAberturaDiaria({ usuarioId: 'u1', usuarios, calcular: resumo(2), agora })).abrir).toBe(false);
  });

  it('um usuário em dois aparelhos: o estado é do servidor, só o 1º abre', async () => {
    const estado = new Map<string, Date | null>([['u1', null]]);
    const usuarios = fakeUsuarios(estado);
    const agora = BRT('2026-10-14T08:00:00');
    const celular = await verificarAberturaDiaria({ usuarioId: 'u1', usuarios, calcular: resumo(2), agora });
    const desktop = await verificarAberturaDiaria({ usuarioId: 'u1', usuarios, calcular: resumo(2), agora: BRT('2026-10-14T08:05:00') });
    expect([celular.abrir, desktop.abrir]).toEqual([true, false]);
  });

  it('o update é condicional (where com a data diferente de hoje)', async () => {
    const usuarios = fakeUsuarios(new Map([['u1', null]]));
    await verificarAberturaDiaria({ usuarioId: 'u1', usuarios, calcular: resumo(1), agora: BRT('2026-10-14T08:00:00') });
    expect(usuarios.calls[0]).toEqual({
      id: 'u1',
      OR: [{ ultimaVerificacaoPendencias: null }, { ultimaVerificacaoPendencias: { not: new Date('2026-10-14T00:00:00.000Z') } }],
    });
  });
});
