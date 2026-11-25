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

import { decidirSyncContraInativo, formatarDataHoraBr } from './registro-inativo';

describe('309/C4a · sync offline contra checklist inativo (regra pura)', () => {
  const em = new Date('2026-10-20T17:00:00.000Z'); // 20/10/2026 14:00 em São Paulo
  it('formata dd/mm/aaaa hh:mm em America/Sao_Paulo', () => {
    expect(formatarDataHoraBr(em)).toBe('20/10/2026 14:00');
  });
  it('ativo → segue o fluxo normal', () => {
    expect(decidirSyncContraInativo({ ativo: true, inativadoEm: null }, em).tipo).toBe('ATIVO');
  });
  it('antes (1 ms) → aceita como existente', () => {
    expect(decidirSyncContraInativo({ ativo: false, inativadoEm: em }, new Date(em.getTime() - 1)).tipo).toBe('ACEITA_EXISTENTE');
  });
  it('fronteira: igual → recusa', () => {
    const d = decidirSyncContraInativo({ ativo: false, inativadoEm: em }, new Date(em.getTime()));
    expect(d.tipo).toBe('REJEITA');
  });
  it('depois → recusa com o motivo e as duas datas', () => {
    const d = decidirSyncContraInativo({ ativo: false, inativadoEm: em }, new Date('2026-10-21T12:15:00.000Z'));
    expect(d.tipo).toBe('REJEITA');
    expect(d.tipo === 'REJEITA' && d.mensagem).toBe(
      'Este checklist está inativo e não pode iniciar vistoria, documento ou aplicação nova. Ele foi inativado em 20/10/2026 14:00, antes do check-in desta vistoria (21/10/2026 09:15). A vistoria continua salva no aparelho.',
    );
  });
  it('sem data de inativação → recusa (não há como provar que foi antes)', () => {
    expect(decidirSyncContraInativo({ ativo: false, inativadoEm: null }, em).tipo).toBe('REJEITA');
  });
});

import { instanteCorteSync } from './registro-inativo';

describe('309/C4a · regra final: corte = check-in, UTC, sem tolerância', () => {
  const em = new Date('2026-10-20T17:00:00.000Z'); // inativadoEm em UTC
  const d = (iso: string) => decidirSyncContraInativo({ ativo: false, inativadoEm: em }, instanteCorteSync({ iniciadaEm: iso })!).tipo;
  it('1 s antes → aceita', () => expect(d('2026-10-20T16:59:59.000Z')).toBe('ACEITA_EXISTENTE'));
  it('exatamente igual → 409', () => expect(d('2026-10-20T17:00:00.000Z')).toBe('REJEITA'));
  it('1 s depois → 409', () => expect(d('2026-10-20T17:00:01.000Z')).toBe('REJEITA'));
  it('aparelho em -03:00 x servidor UTC: mesmo instante é igual (409); 1 s antes aceita', () => {
    expect(instanteCorteSync({ iniciadaEm: '2026-10-20T14:00:00.000-03:00' })!.toISOString()).toBe('2026-10-20T17:00:00.000Z');
    expect(d('2026-10-20T14:00:00.000-03:00')).toBe('REJEITA');
    expect(d('2026-10-20T13:59:59.000-03:00')).toBe('ACEITA_EXISTENTE');
  });
  it('sem check-in → primeiro horário do aparelho no pacote (conclusão ou capturas)', () => {
    const corte = instanteCorteSync({
      concluidaEm: '2026-10-20T17:10:00.000Z',
      respostas: [{ evidencias: [{ capturadaEm: '2026-10-20T13:59:59.000-03:00' }, { capturadaEm: '2026-10-20T17:05:00.000Z' }] }],
    });
    expect(corte!.toISOString()).toBe('2026-10-20T16:59:59.000Z');
    expect(decidirSyncContraInativo({ ativo: false, inativadoEm: em }, corte!).tipo).toBe('ACEITA_EXISTENTE');
    expect(instanteCorteSync({ concluidaEm: '2026-10-20T17:00:00.000Z' })!.toISOString()).toBe(em.toISOString());
    expect(instanteCorteSync({})).toBeNull();
  });
});
