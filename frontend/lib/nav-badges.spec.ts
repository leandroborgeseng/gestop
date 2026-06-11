import { describe, expect, it } from 'vitest';
import { buildNavBadges, resolveGlobalSearchRoute } from './nav-badges';

describe('buildNavBadges', () => {
  const resumo = {
    chamadosAbertos: 12,
    eventosSyncPendentes: 3,
  } as Parameters<typeof buildNavBadges>[0];

  const alertas = {
    resumo: {
      chamadosSemTriagem: 4,
      chamadosUrgentes: 2,
      syncFalhas: 1,
      chamadosAtrasados: 0,
    },
  } as Parameters<typeof buildNavBadges>[1];

  it('usa apenas chamadosAbertos do resumo, sem somar alertas', () => {
    const badges = buildNavBadges(resumo, alertas, ['chamados.gerenciar']);
    expect(badges.chamados).toBe(12);
  });

  it('usa eventosSyncPendentes do resumo para integracoes', () => {
    const badges = buildNavBadges(resumo, alertas, ['auditoria.visualizar']);
    expect(badges.integracoes).toBe(3);
  });

  it('nao exibe badge quando contagem e zero', () => {
    const badges = buildNavBadges(
      { chamadosAbertos: 0, eventosSyncPendentes: 0 } as Parameters<typeof buildNavBadges>[0],
      alertas,
      ['chamados.gerenciar', 'auditoria.visualizar'],
    );
    expect(badges).toEqual({});
  });

  it('exibe badge para operador com chamados.executar', () => {
    const badges = buildNavBadges(resumo, alertas, ['chamados.executar']);
    expect(badges.chamados).toBe(12);
  });

  it('respeita permissoes do usuario', () => {
    expect(buildNavBadges(resumo, alertas, [])).toEqual({});
  });
});

describe('resolveGlobalSearchRoute', () => {
  it('envia codigos de chamado para a lista de chamados', () => {
    expect(resolveGlobalSearchRoute('CH-2026-000001')).toBe('/chamados?search=CH-2026-000001');
  });

  it('envia busca generica para a CCO', () => {
    expect(resolveGlobalSearchRoute('Escola Municipal')).toBe('/cco?search=Escola%20Municipal');
  });
});
