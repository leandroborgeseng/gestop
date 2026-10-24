import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertRegistroEditavel,
  assertRegistroPodeIniciar,
  auditoriaStatusAtivo,
  CHECKLIST_INATIVO,
  planejarStatusAtivo,
} from './registro-inativo';

describe('309 · padrão comum de inativos (backend)', () => {
  it('C3: inativo → 409 com a mensagem exata; ativo passa', () => {
    expect(() => assertRegistroEditavel({ ativo: true }, CHECKLIST_INATIVO)).not.toThrow();
    try {
      assertRegistroEditavel({ ativo: false }, CHECKLIST_INATIVO);
      throw new Error('não lançou');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getStatus()).toBe(409);
      expect((e as ConflictException).message).toBe('Este checklist está inativo. Reative o modelo para realizar alterações');
      expect((e as ConflictException).getResponse()).toMatchObject({ code: 'REGISTRO_INATIVO' });
    }
  });

  it('C4: inativo não inicia uso novo', () => {
    expect(() => assertRegistroPodeIniciar({ ativo: false }, CHECKLIST_INATIVO)).toThrow(CHECKLIST_INATIVO.mensagemNaoInicia);
    expect(() => assertRegistroPodeIniciar({ ativo: true }, CHECKLIST_INATIVO)).not.toThrow();
  });

  it('C2: transições válidas e repetição → 409', () => {
    expect(planejarStatusAtivo(true, 'INATIVAR', CHECKLIST_INATIVO)).toBe(false);
    expect(planejarStatusAtivo(false, 'REATIVAR', CHECKLIST_INATIVO)).toBe(true);
    expect(() => planejarStatusAtivo(false, 'INATIVAR', CHECKLIST_INATIVO)).toThrow(ConflictException);
    expect(() => planejarStatusAtivo(true, 'REATIVAR', CHECKLIST_INATIVO)).toThrow('Este checklist já está ativo.');
  });

  it('C6: auditoria leva quem, quando, antes e depois', () => {
    const quando = new Date('2026-10-23T12:00:00Z');
    const r = auditoriaStatusAtivo({ acao: 'INATIVAR', usuarioId: 'u1', quando, antes: { ativo: true }, depois: { ativo: false } });
    expect(r.valorAntigo).toEqual({ evento: 'INATIVAR', usuarioId: 'u1', em: '2026-10-23T12:00:00.000Z', ativo: true });
    expect(r.valorNovo).toEqual({ evento: 'INATIVAR', usuarioId: 'u1', em: '2026-10-23T12:00:00.000Z', ativo: false });
  });
});
