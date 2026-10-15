import '@/test-utils/jsdom-global';
import { createElement, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChamadoTarefaDetalhe } from '@/lib/chamado-tarefa';

/**
 * 293 · interação real: o texto digitado em "Registrar andamento" / "Concluir tarefa" chega na API e
 * aparece no Histórico da tarefa — pelos dois pontos de entrada (Execução > Tarefas e Tarefas do chamado).
 * O "servidor" falso só devolve o que recebeu no payload; se o front perder o texto, o histórico fica sem ele.
 */
type Hist = ChamadoTarefaDetalhe['historico'][number];
const servidor = vi.hoisted(() => ({ tarefa: null as unknown as Record<string, unknown>, payloads: [] as Array<Record<string, unknown>>, seq: 0 }));

function tarefaBase(): ChamadoTarefaDetalhe {
  return {
    id: 't1', titulo: 'Trocar lâmpadas do pátio', descricao: null, prazo: null, prioridade: 'MEDIA', status: 'NOVA', justificativa: null, conclusaoTexto: null,
    observacao: null, atrasada: false, createdAt: '2026-10-01T12:00:00.000Z', concluidaEm: null, visualizadaEm: null,
    secretaria: { id: 's1', nome: 'Secretaria', sigla: 'SEC' }, equipe: null, responsavel: { id: 'u1', nome: 'Bruno' },
    criadaPor: null, concluidaPor: null, anexos: [], podeTratar: true, podeAlterarDados: false, podeAndamento: true, podeConcluir: true,
    podeCancelar: false, podeVerHistorico: true, podeVerAnexos: true, historico: [],
    chamado: { id: 'c1', codigo: 'CH-1', titulo: 'Chamado', descricao: '', status: 'EM_EXECUCAO', prioridade: 'MEDIA', enderecoTexto: null, prazoEm: null,
      latitude: null, longitude: null, tipoChamado: null, unidade: null, secretaria: null, equipe: null },
  } as unknown as ChamadoTarefaDetalhe;
}

vi.mock('@/components/ui/snackbar', () => ({ useSnackbar: () => ({ show: () => undefined }) }));
vi.mock('@/components/auth/session-context', () => ({ useSessionUser: () => ({ permissoes: [] }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('tarefa=t1'), useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? createElement('div', { 'data-testid': 'sheet' }, children) : null),
}));
vi.mock('@/components/chamados/chamados-execucao-map', () => ({ ChamadosExecucaoMap: () => null }));
vi.mock('@/lib/api', () => ({
  getChamadoTarefa: () => Promise.resolve(structuredClone(servidor.tarefa)),
  getChamadoLeituraViaTarefa: () => Promise.reject(new Error('sem leitura')),
  getOpcoesTarefa: () => Promise.resolve({ secretarias: [], equipes: [] }),
  listTarefasDoChamado: () => Promise.resolve({ items: [], pendentes: 0 }),
  createChamadoTarefa: vi.fn(),
  listTarefasExecucao: () => Promise.resolve({ total: 0, contadores: { novas: 0, emAndamento: 0, atrasadas: 0 }, items: [] }),
  getSecretarias: () => Promise.resolve([]),
  listEquipesExecucao: () => Promise.resolve([]),
  listUsuariosAtivosExecucao: () => Promise.resolve([]),
  listTiposChamadoOpcoes: () => Promise.resolve([]),
  updateChamadoTarefa: (_id: string, payload: Record<string, unknown>) => {
    servidor.payloads.push(payload);
    const t = servidor.tarefa as unknown as ChamadoTarefaDetalhe;
    const acao = payload.status === 'CONCLUIDA' ? 'concluida' : 'andamento';
    const texto = (payload.status === 'CONCLUIDA' ? payload.conclusaoTexto : payload.observacao) as string | undefined;
    const anexos = (payload.anexos as Array<{ nome: string }> | undefined) ?? [];
    const anexoIds = anexos.map((a) => {
      const id = `anx-${++servidor.seq}`;
      t.anexos.push({ id, nome: a.nome, url: `/storage/${id}`, mimeType: 'application/pdf', tamanhoBytes: 1, createdAt: '2026-10-15T13:00:00.000Z' } as never);
      return id;
    });
    const ev: Hist = {
      id: `h-${++servidor.seq}`, motivo: 'x', statusAnterior: t.status, statusNovo: payload.status as string,
      createdAt: '2026-10-15T13:05:00.000Z', alteradoPor: { id: 'u1', nome: 'Bruno' }, acao, anexoIds, temAnexos: anexoIds.length > 0,
      texto: texto ?? null,
      textoOrigem: texto ? 'evento' : null,
    };
    t.historico.push(ev);
    t.status = payload.status as never;
    if (acao === 'concluida') { t.podeAndamento = false; t.podeConcluir = false; }
    return Promise.resolve(structuredClone(t));
  },
}));

import { ChamadoTarefasPanel } from './chamado-tarefas-panel';
import { ExecucaoTarefasPanel } from './execucao-tarefas-panel';

const PONTOS = {
  execucao: () => createElement(ExecucaoTarefasPanel),
  chamado: () => createElement(ChamadoTarefasPanel, { chamadoId: 'c1', onClose: () => undefined }),
} as const;

async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}
async function abrir(ponto: keyof typeof PONTOS) {
  render(PONTOS[ponto]());
  await flush();
  await screen.findByText('Trocar lâmpadas do pátio');
}
async function registrar(botao: 'Registrar andamento' | 'Concluir tarefa', rotulo: string, texto: string, arquivos: File[] = []) {
  fireEvent.click(screen.getByRole('button', { name: botao }));
  expect(screen.getByText(rotulo)).toBeTruthy();
  const caixas = screen.getByTestId('sheet').querySelectorAll('textarea');
  expect(caixas).toHaveLength(1);
  const caixa = caixas[0];
  fireEvent.change(caixa, { target: { value: texto } });
  if (arquivos.length) {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: arquivos } });
      await new Promise((r) => setTimeout(r, 20));
    });
  }
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}
const itens = () => screen.queryAllByTestId('historico-item');
const textos = () => screen.queryAllByTestId('historico-texto').map((el) => el.textContent);

beforeEach(() => {
  servidor.tarefa = tarefaBase() as unknown as Record<string, unknown>;
  servidor.payloads = [];
  servidor.seq = 0;
});
afterEach(() => cleanup());

for (const ponto of ['execucao', 'chamado'] as const) {
  describe(`293 · ${ponto === 'execucao' ? 'Execução > Tarefas' : 'Tarefas do chamado'}`, () => {
    it('andamento multilinha: payload íntegro e histórico com evento, tarefa, data/usuário e texto com quebras', async () => {
      await abrir(ponto);
      const texto = 'Linha 1\nLinha 2\n\n  Linha 4';
      await registrar('Registrar andamento', 'Registro de andamento', texto);
      expect(servidor.payloads).toHaveLength(1);
      expect(servidor.payloads[0]).toMatchObject({ status: 'EM_ANDAMENTO', observacao: 'Linha 1\nLinha 2\n\n  Linha 4' });
      expect(itens()).toHaveLength(1);
      expect(within(itens()[0]).getByTestId('historico-cabecalho').textContent).toBe('Andamento · Trocar lâmpadas do pátio');
      expect(itens()[0].textContent).toContain('Bruno');
      expect(itens()[0].textContent).toContain(new Date('2026-10-15T13:05:00.000Z').toLocaleString('pt-BR'));
      const p = within(itens()[0]).getByTestId('historico-texto');
      expect(p.textContent).toBe('Linha 1\nLinha 2\n\n  Linha 4');
      expect(p.style.whiteSpace).toBe('pre-wrap');
    });

    it('Q5: envia e mostra o texto exatamente como digitado (espaços/quebras nas pontas)', async () => {
      await abrir(ponto);
      await registrar('Registrar andamento', 'Registro de andamento', '  inicio\n...\nfim  \n');
      expect(servidor.payloads[0].observacao).toBe('  inicio\n...\nfim  \n');
      expect(textos()).toEqual(['  inicio\n...\nfim  \n']);
    });

    it('Q5: conclusão envia conclusaoTexto exatamente como digitado', async () => {
      await abrir(ponto);
      await registrar('Concluir tarefa', 'Texto de conclusão', '  fim\n');
      expect(servidor.payloads[0].status).toBe('CONCLUIDA');
      expect(servidor.payloads[0].conclusaoTexto).toBe('  fim\n');
    });

    it('dois andamentos seguidos: dois registros, na ordem, nenhum sobrescreve', async () => {
      await abrir(ponto);
      await registrar('Registrar andamento', 'Registro de andamento', 'Primeiro');
      await registrar('Registrar andamento', 'Registro de andamento', 'Segundo');
      expect(textos()).toEqual(['Primeiro', 'Segundo']);
    });

    it('conclusão com texto + anexo: texto primeiro, anexo depois, no mesmo evento; badge Concluída', async () => {
      await abrir(ponto);
      const JsdomFile = (window as unknown as { File: typeof File }).File; // File do jsdom (o FileReader do jsdom não aceita o File do Node)
      const pdf = new JsdomFile(['%PDF-1.4'], 'laudo.pdf', { type: 'application/pdf' });
      await registrar('Concluir tarefa', 'Texto de conclusão', 'Concluído:\n- lâmpadas trocadas', [pdf]);
      expect(servidor.payloads[0]).toMatchObject({ status: 'CONCLUIDA', conclusaoTexto: 'Concluído:\n- lâmpadas trocadas' });
      expect((servidor.payloads[0].anexos as unknown[]).length).toBe(1);
      const item = itens()[0];
      expect(within(item).getByTestId('historico-cabecalho').textContent).toBe('Conclusão · Trocar lâmpadas do pátioConcluída');
      const texto = within(item).getByTestId('historico-texto');
      const anexos = within(item).getByTestId('historico-anexos');
      expect(texto.textContent).toBe('Concluído:\n- lâmpadas trocadas');
      expect(anexos.textContent).toContain('laudo.pdf');
      expect(texto.compareDocumentPosition(anexos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
}

describe('293b · registros legados no histórico da tarefa', () => {
  const ev = (over: Partial<Hist>): Hist => ({ id: `h-${over.acao}`, motivo: 'm', statusAnterior: 'NOVA', statusNovo: 'X', createdAt: '2026-01-01T10:00:00.000Z', alteradoPor: { id: 'u1', nome: 'Bruno' }, anexoIds: [], ...over });
  async function montar(historico: Hist[], over: Partial<ChamadoTarefaDetalhe> = {}) {
    servidor.tarefa = { ...tarefaBase(), observacao: 'OBSERVACAO DA TAREFA', ...over, historico } as unknown as Record<string, unknown>;
    await abrir('chamado');
  }
  it('conclusão legada mostra o conclusaoTexto (sem rótulo "Registro anterior")', async () => {
    await montar([ev({ acao: 'concluida', texto: 'Conclusão antiga\nduas linhas', textoOrigem: 'conclusao' })]);
    expect(textos()).toEqual(['Conclusão antiga\nduas linhas']);
    expect(screen.queryAllByTestId('historico-registro-anterior')).toHaveLength(0);
  });
  it('andamento legado mostra o resumo inteiro com o rótulo "Registro anterior" antes do texto', async () => {
    const resumo = 'Status: EM_ANDAMENTO · Equipe: Elétrica · texto antigo';
    await montar([ev({ acao: 'andamento', texto: resumo, textoOrigem: 'registro_anterior' })]);
    const rotulo = screen.getByTestId('historico-registro-anterior');
    expect(rotulo.textContent).toBe('Registro anterior');
    const texto = screen.getByTestId('historico-texto');
    expect(texto.textContent).toBe(resumo);
    expect(rotulo.compareDocumentPosition(texto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('andamento legado sem texto: nunca mostra a observacao da tarefa, nem placeholder', async () => {
    await montar([ev({ acao: 'andamento', texto: null, textoOrigem: null })]);
    expect(itens()).toHaveLength(1);
    expect(screen.queryAllByTestId('historico-texto')).toHaveLength(0);
    expect(screen.queryAllByTestId('historico-registro-anterior')).toHaveLength(0);
    expect(itens()[0].textContent).not.toContain('OBSERVACAO DA TAREFA');
  });
  it('evento novo com texto não mostra "Registro anterior"', async () => {
    await montar([ev({ acao: 'andamento', texto: 'Texto novo', textoOrigem: 'evento' })]);
    expect(textos()).toEqual(['Texto novo']);
    expect(screen.queryAllByTestId('historico-registro-anterior')).toHaveLength(0);
  });
});

describe('293 · registro antigo sem texto', () => {
  it('mostra só cabeçalho e meta, sem placeholder', async () => {
    const t = tarefaBase();
    t.historico.push({ id: 'h-old', motivo: 'Andamento da tarefa: X', statusAnterior: 'NOVA', statusNovo: 'EM_ANDAMENTO', createdAt: '2026-01-01T10:00:00.000Z', alteradoPor: { id: 'u1', nome: 'Bruno' }, acao: 'andamento', anexoIds: [] });
    servidor.tarefa = t as unknown as Record<string, unknown>;
    await abrir('chamado');
    expect(itens()).toHaveLength(1);
    expect(screen.queryAllByTestId('historico-texto')).toHaveLength(0);
    expect(itens()[0].textContent).not.toMatch(/Sem descrição|Sem texto/);
  });
});
