import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getWebmapCamadasStatus: vi.fn(),
  getWebmapCamadasHistorico: vi.fn(),
  simularWebmapCamadas: vi.fn(),
  aplicarWebmapCamadas: vi.fn(),
  downloadWebmapCamadasErrosCsv: vi.fn(),
}));
vi.mock('@/lib/api', () => api);

import { WebmapCamadasPanel, linhaUltimaAplicacao } from './webmap-camadas-panel';

const base = { fonte: 'github', emAndamento: null, ultima: null, ultimaImportacao: null, camadas: 0, ativas: 0, removidasOrigem: 0 };
const sim = (totalErros: number) => ({
  simulacaoId: 's1', fonte: 'g', commitSha: 'c', fonteHash: 'h', criadaEm: new Date().toISOString(), expiraEm: new Date(Date.now() + 1800_000).toISOString(),
  grupos: 2, camadas: 3, elementos: { pontos: 4, linhas: 1, poligonos: 2, total: 7 }, corrigidos: 0, invalidos: totalErros, novas: 3, atualizadas: 0, semMudanca: 0, reativadas: 0, removidasOrigem: 0,
  camadasDetalhe: [{ chaveOrigem: 'G/A', grupo: 'G', nomeOriginal: 'A', variavel: 'A_1', ordem: 0, status: 'nova', elementos: { pontos: 1, linhas: 0, poligonos: 0 }, corrigidos: 0, invalidos: 0, bytes: 1 }],
  erros: Array.from({ length: Math.min(totalErros, 50) }, (_, i) => ({ camada: 'A', elemento: String(i), motivo: 'Elemento sem geometria' })),
  totalErros, resultadoPrevisto: totalErros ? 'PARCIAL' : 'SUCESSO',
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('296 · WebmapCamadasPanel', () => {
  it('sem permissão de executar: não mostra o botão', async () => {
    api.getWebmapCamadasStatus.mockResolvedValue(base);
    api.getWebmapCamadasHistorico.mockResolvedValue([]);
    await act(async () => { render(createElement(WebmapCamadasPanel, { canExec: false })); });
    expect(screen.queryByRole('button', { name: /Importar apenas camadas Webmap/ })).toBeNull();
  });

  it('simula, mostra contagens, no máximo 50 erros + CSV; Aplicar só depois da simulação', async () => {
    api.getWebmapCamadasStatus.mockResolvedValue(base);
    api.getWebmapCamadasHistorico.mockResolvedValue([]);
    api.simularWebmapCamadas.mockResolvedValue(sim(120));
    await act(async () => { render(createElement(WebmapCamadasPanel, { canExec: true })); });
    expect(screen.queryByRole('button', { name: 'Aplicar' })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Importar apenas camadas Webmap/ })); });
    expect(screen.getByText('Elementos irreparáveis (50 de 120)')).toBeTruthy();
    expect(screen.getAllByText(/Elemento sem geometria/)).toHaveLength(50);
    expect(screen.getByRole('button', { name: 'Baixar CSV com todos os erros' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeTruthy();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('resultado da última aplicação aparece ao voltar à tela (OK com avisos)', async () => {
    api.getWebmapCamadasStatus.mockResolvedValue({ ...base, ultimaImportacao: { id: 'j', status: 'OK_COM_AVISOS', usuario: 'Ana', iniciadoEmBrt: 'x', concluidoEmBrt: '20/10/2026 13:00:00 (BRT)', motivo: null, resultado: { ...sim(0), corrigidos: 7, resultado: 'OK_COM_AVISOS' } } });
    api.getWebmapCamadasHistorico.mockResolvedValue([]);
    await act(async () => { render(createElement(WebmapCamadasPanel, { canExec: true })); });
    expect(screen.getByText(/Última aplicação: OK com avisos/)).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('em andamento: mostra quem e desde quando e bloqueia o botão', async () => {
    api.getWebmapCamadasStatus.mockResolvedValue({ ...base, emAndamento: { tipo: 'APLICACAO', usuario: 'Ana', desde: '', desdeBrt: '20/10/2026 12:40:00 (BRT)', fase: 'gravando', importacaoId: 'j' } });
    api.getWebmapCamadasHistorico.mockResolvedValue([]);
    await act(async () => { render(createElement(WebmapCamadasPanel, { canExec: true })); });
    expect(screen.getByText(/Ana desde 20\/10\/2026 12:40:00 \(BRT\)/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Importar apenas camadas Webmap/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('296 pacote (c) · reordenadas', () => {
  it('contador informativo separado aparece só quando > 0', async () => {
    api.getWebmapCamadasStatus.mockResolvedValue(base);
    api.getWebmapCamadasHistorico.mockResolvedValue([]);
    api.simularWebmapCamadas.mockResolvedValue({ ...sim(0), reordenadas: 3 });
    await act(async () => { render(createElement(WebmapCamadasPanel, { canExec: true })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Importar apenas camadas Webmap/ })); });
    expect(screen.getByTestId('webmap-reordenadas').textContent).toMatch(/^Reordenadas: 3 \(informativo/);
    cleanup();
    api.simularWebmapCamadas.mockResolvedValue({ ...sim(0), reordenadas: 0 });
    await act(async () => { render(createElement(WebmapCamadasPanel, { canExec: true })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Importar apenas camadas Webmap/ })); });
    expect(screen.queryByTestId('webmap-reordenadas')).toBeNull();
  });
});

describe('296 pacote (a) · confirmação antes de aplicar', () => {
  it('N > 0: diálogo literal; Cancelar não aplica; Aplicar no diálogo aplica', async () => {
    api.getWebmapCamadasStatus.mockResolvedValue(base);
    api.getWebmapCamadasHistorico.mockResolvedValue([]);
    api.simularWebmapCamadas.mockResolvedValue(sim(425));
    api.aplicarWebmapCamadas.mockResolvedValue({});
    await act(async () => { render(createElement(WebmapCamadasPanel, { canExec: true })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Importar apenas camadas Webmap/ })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aplicar' })); });
    const dlg = screen.getByRole('alertdialog');
    expect(dlg.textContent).toContain('Aplicar importação? 425 elementos serão gravados como inválidos e não aparecerão no mapa (detalhes no CSV).');
    expect(api.aplicarWebmapCamadas).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.aplicarWebmapCamadas).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aplicar' })); });
    const dentro = screen.getByRole('alertdialog').querySelectorAll('button');
    await act(async () => { fireEvent.click(dentro[dentro.length - 1]); });
    expect(api.aplicarWebmapCamadas).toHaveBeenCalledWith('s1');
  });

  it('N = 0: aplica direto, sem diálogo', async () => {
    api.getWebmapCamadasStatus.mockResolvedValue(base);
    api.getWebmapCamadasHistorico.mockResolvedValue([]);
    api.simularWebmapCamadas.mockResolvedValue(sim(0));
    api.aplicarWebmapCamadas.mockResolvedValue({});
    await act(async () => { render(createElement(WebmapCamadasPanel, { canExec: true })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Importar apenas camadas Webmap/ })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aplicar' })); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.aplicarWebmapCamadas).toHaveBeenCalledTimes(1);
  });
});

describe('296 pacote (d) · linha da última aplicação', () => {
  it('formato resultado · dd/mm/aaaa HH:mm (BRT) · usuário', async () => {
    expect(linhaUltimaAplicacao('PARCIAL', '20/10/2026 15:40:12 (BRT)', 'Tester Importação')).toBe('Parcial · 20/10/2026 15:40 (BRT) · Tester Importação');
    api.getWebmapCamadasStatus.mockResolvedValue({ ...base, ultimaImportacao: { id: 'j', status: 'PARCIAL', usuario: 'Tester Importação', iniciadoEmBrt: 'x', concluidoEmBrt: '20/10/2026 15:40:00 (BRT)', motivo: null, resultado: { ...sim(3), resultado: 'PARCIAL' } } });
    api.getWebmapCamadasHistorico.mockResolvedValue([]);
    await act(async () => { render(createElement(WebmapCamadasPanel, { canExec: true })); });
    expect(screen.getByText('Última aplicação: Parcial · 20/10/2026 15:40 (BRT) · Tester Importação')).toBeTruthy();
  });
});
