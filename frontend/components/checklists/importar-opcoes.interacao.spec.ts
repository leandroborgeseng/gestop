import '@/test-utils/jsdom-global';
import { createElement, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

const snack = vi.hoisted(() => ({ msgs: [] as string[] }));
vi.mock('@/components/ui/snackbar', () => ({ useSnackbar: () => ({ show: (m: string) => snack.msgs.push(m) }) }));
vi.mock('@/lib/api', () => ({ listTiposProprioOpcoes: () => Promise.resolve([]) }));

import { MultiplaEscolhaEditor, VersionEditor } from './checklist-shared';

type Cfg = { opcoes: string[]; notas?: Array<number | null>; selecao: string; modoExibicao: string };
const estado: { atual: Cfg | null; mudancas: number } = { atual: null, mudancas: 0 };

function Harness({ inicial, finalidade, simplified }: { inicial: Cfg; finalidade: 'VISTORIA' | 'CHAMADO' | 'DOCUMENTO_AVULSO'; simplified: boolean }) {
  const [opcoes, setOpcoes] = useState<unknown>(inicial);
  return createElement(MultiplaEscolhaEditor, {
    opcoes,
    simplified,
    finalidade,
    onChange: (o: unknown) => {
      estado.atual = o as Cfg;
      estado.mudancas++;
      setOpcoes(o);
    },
  });
}

async function montar(inicial: Cfg, finalidade: 'VISTORIA' | 'CHAMADO' | 'DOCUMENTO_AVULSO' = 'VISTORIA') {
  render(createElement(Harness, { inicial, finalidade, simplified: finalidade !== 'VISTORIA' }));
}
const dialog = () => screen.getByTestId('importar-opcoes-dialog');
const confirmar = () => screen.getByTestId('importar-opcoes-confirmar') as HTMLButtonElement;
async function abrir() {
  fireEvent.click(screen.getByRole('button', { name: 'Importar lista de opções' }));
}
async function enviar(file: File) {
  await act(async () => {
    fireEvent.change(screen.getByTestId('importar-opcoes-arquivo'), { target: { files: [file] } });
    for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
  });
}
const csv = (conteudo: string, nome = 'opcoes.csv') => new File([conteudo], nome, { type: 'text/csv' });
function xlsx(abas: Record<string, unknown[][]>) {
  const wb = XLSX.utils.book_new();
  for (const [nome, linhas] of Object.entries(abas)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), nome);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], 'opcoes.xlsx');
}
const vazio: Cfg = { opcoes: ['', ''], selecao: 'UNICA', modoExibicao: 'SELECT' };

beforeEach(() => {
  estado.atual = null;
  estado.mudancas = 0;
  snack.msgs = [];
});
afterEach(() => cleanup());

describe('294 · gatilho', () => {
  it('"Importar lista de opções" fica ao lado de "Cadastrar mais opções" (que continua)', async () => {
    await montar(vazio);
    const importar = screen.getByRole('button', { name: 'Importar lista de opções' });
    const cadastrar = screen.getByRole('button', { name: 'Cadastrar mais opções' });
    expect(importar.parentElement).toBe(cadastrar.parentElement);
    expect(cadastrar.compareDocumentPosition(importar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('294 · gatilho só em múltipla escolha', () => {
  it('ausente para outros tipos e aparece ao trocar para Múltipla escolha', async () => {
    const versao = { id: 'v1', itens: [{ id: 'i1', ordem: 1, codigo: 'P1', secao: '', titulo: 'P', tipo: 'TEXTO', obrigatorio: false, geraNaoConformidade: false, exigeEvidencia: false, categoriaVistoriaId: 'c1', opcoes: null }] };
    render(createElement(VersionEditor, { version: versao as never, categorias: [{ id: 'c1', nome: 'Cat', ativo: true }] as never, onSave: () => {}, onPublish: () => {} }));
    const tipo = screen.getByDisplayValue('Texto') as HTMLSelectElement;
    for (const outro of [...tipo.options].map((o) => o.value).filter((v) => v !== 'MULTIPLA_ESCOLHA')) {
      fireEvent.change(tipo, { target: { value: outro } });
      expect(screen.queryByRole('button', { name: 'Importar lista de opções' }), outro).toBeNull();
    }
    fireEvent.change(tipo, { target: { value: 'MULTIPLA_ESCOLHA' } });
    expect(screen.getByRole('button', { name: 'Importar lista de opções' })).toBeTruthy();
  });
});

describe('294 · estados do modal', () => {
  it('escolha: explicação, formatos, Selecionar arquivo e Baixar modelo; sem botão de importar', async () => {
    await montar(vazio);
    await abrir();
    const d = within(dialog());
    expect(d.getByText('Uma opção por linha. A primeira linha é o cabeçalho: Opção{, Nota}.')).toBeTruthy();
    expect(d.getByText('Formatos aceitos: XLSX, XLS, CSV, TXT, até 500 opções.')).toBeTruthy();
    expect(d.getByRole('button', { name: 'Selecionar arquivo' })).toBeTruthy();
    expect(d.getByRole('button', { name: 'Baixar modelo' })).toBeTruthy();
    expect(screen.queryByTestId('importar-opcoes-confirmar')).toBeNull();
    expect(dialog().getAttribute('aria-modal')).toBe('true');
  });

  it('prévia de CSV (; + BOM): contagem, lista na ordem; importar sem opções atuais substitui direto', async () => {
    await montar(vazio);
    await abrir();
    await enviar(csv('\uFEFFOPÇÃO;Nota\r\nÓtimo;10\r\n\r\nBom;7,5\r\nRuim;\r\n'));
    expect(screen.getByTestId('importar-opcoes-resumo').textContent).toBe('3 opções válidas · 1 vazias ignoradas');
    expect([...screen.getByTestId('importar-opcoes-lista').querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Ótimo · nota 10', 'Bom · nota 7.5', 'Ruim']);
    expect(confirmar().textContent).toBe('Importar 3 opções');
    expect(confirmar().disabled).toBe(false);
    await act(async () => fireEvent.click(confirmar()));
    expect(screen.queryByTestId('importar-opcoes-dialog')).toBeNull();
    expect(estado.atual).toEqual({ opcoes: ['Ótimo', 'Bom', 'Ruim'], notas: [10, 7.5, null], selecao: 'UNICA', modoExibicao: 'SELECT' });
    expect(snack.msgs).toEqual(['3 opções importadas. Salve o rascunho para manter.']);
    expect((document.activeElement as HTMLInputElement).value).toBe('Ótimo');
  });

  it('erros com número da linha bloqueiam "Importar"', async () => {
    await montar(vazio);
    await abrir();
    await enviar(csv('Opção,Nota\nA,5\n,3\nB,12\n'));
    expect([...screen.getByTestId('importar-opcoes-erros').querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Linha 3: opção sem nome.',
      'Linha 4: nota inválida (use um número de 0 a 10).',
    ]);
    expect(screen.getByTestId('importar-opcoes-resumo').textContent).toBe('1 opção válida · 2 linhas com erro');
    expect(confirmar().disabled).toBe(true);
    expect(screen.getByText('Corrija o arquivo e selecione de novo.')).toBeTruthy();
    fireEvent.click(confirmar());
    expect(estado.mudancas).toBe(0);
  });

  it('sem cabeçalho: mensagem apontando o modelo, nada importável', async () => {
    await montar(vazio);
    await abrir();
    await enviar(csv('Nome;Valor\nA;1\n'));
    expect(screen.getByTestId('importar-opcoes-erros').textContent).toBe('Cabeçalho não encontrado: a primeira linha precisa da coluna "Opção". Use "Baixar modelo" para ver o formato.');
    expect(confirmar().disabled).toBe(true);
  });

  it('documento avulso: Nota ignorada com aviso; nenhuma nota gravada', async () => {
    await montar({ ...vazio }, 'DOCUMENTO_AVULSO');
    await abrir();
    await enviar(csv('Opção;Nota\nSim;10\nNão;0\n'));
    expect(screen.getByTestId('importar-opcoes-aviso').textContent).toBe('A coluna "Nota" foi ignorada: checklist de documento avulso não usa nota nem conformidade.');
    await act(async () => fireEvent.click(confirmar()));
    expect(estado.atual).toEqual({ opcoes: ['Sim', 'Não'], selecao: 'UNICA', modoExibicao: 'SELECT' });
  });

  it('XLSX com várias abas: usuário escolhe a aba; 200 opções viram 200 na ordem; "Mostrar todas"', async () => {
    const muitas = [['Opção'], ...Array.from({ length: 200 }, (_, i) => [`Item ${i + 1}`])];
    await montar(vazio);
    await abrir();
    await enviar(xlsx({ Resumo: [['Opção'], ['Só uma']], Lista: muitas }));
    expect(screen.getByTestId('importar-opcoes-resumo').textContent).toBe('1 opção válida');
    await act(async () => {
      fireEvent.change(screen.getByTestId('importar-opcoes-aba'), { target: { value: '1' } });
      for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByTestId('importar-opcoes-resumo').textContent).toBe('200 opções válidas');
    expect(screen.getByTestId('importar-opcoes-lista').querySelectorAll('li')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar todas' }));
    expect(screen.getByTestId('importar-opcoes-lista').querySelectorAll('li')).toHaveLength(200);
    await act(async () => fireEvent.click(confirmar()));
    expect(estado.atual!.opcoes).toEqual(Array.from({ length: 200 }, (_, i) => `Item ${i + 1}`));
  });

  it('501 linhas: erro de limite e importação bloqueada', async () => {
    await montar(vazio);
    await abrir();
    await enviar(csv(['Opção', ...Array.from({ length: 501 }, (_, i) => `O${i}`)].join('\n')));
    expect(screen.getByTestId('importar-opcoes-erros').textContent).toBe('O arquivo tem 501 opções; o limite é 500 por pergunta.');
    expect(confirmar().disabled).toBe(true);
  });
});

describe('294 · conflito com opções atuais', () => {
  const atual: Cfg = { opcoes: ['A', 'B'], notas: [1, 2], selecao: 'MULTIPLA', modoExibicao: 'LISTA' };
  async function ateConflito() {
    await montar(atual);
    await abrir();
    await enviar(csv('Opção;Nota\nX;9\nY;8\n'));
    await act(async () => fireEvent.click(confirmar()));
  }
  it('pergunta antes (nunca automático) com Adicionar pré-selecionado', async () => {
    await ateConflito();
    expect(estado.mudancas).toBe(0);
    expect(dialog().querySelector('[data-estado="conflito"]')).toBeTruthy();
    const adicionar = screen.getByLabelText('Adicionar ao final (mantém as 2 atuais)') as HTMLInputElement;
    const substituir = screen.getByLabelText(/Substituir as 2 opções atuais/) as HTMLInputElement;
    expect(adicionar.checked).toBe(true);
    expect(substituir.checked).toBe(false);
  });
  it('Adicionar que passaria de 500: botão Importar com atributo disabled; Substituir libera', async () => {
    await montar({ opcoes: Array.from({ length: 499 }, (_, i) => `A${i}`), selecao: 'UNICA', modoExibicao: 'SELECT' });
    await abrir();
    await enviar(csv('Opção\nX\nY\n'));
    await act(async () => fireEvent.click(confirmar()));
    expect((screen.getByLabelText(/Adicionar ao final/) as HTMLInputElement).checked).toBe(true);
    expect(confirmar().hasAttribute('disabled')).toBe(true);
    await act(async () => fireEvent.click(confirmar()));
    expect(estado.mudancas).toBe(0);
    fireEvent.click(screen.getByLabelText(/Substituir as 499 opções atuais/));
    expect(confirmar().hasAttribute('disabled')).toBe(false);
    // Renderiza 499 opções no jsdom: ~3 s local, passa de 5 s no runner do Actions.
  }, 20_000);
  it('Adicionar ao final: mantém as atuais, seleção e exibição; foco na 1ª importada', async () => {
    await ateConflito();
    await act(async () => fireEvent.click(confirmar()));
    expect(estado.atual).toEqual({ opcoes: ['A', 'B', 'X', 'Y'], notas: [1, 2, 9, 8], selecao: 'MULTIPLA', modoExibicao: 'LISTA' });
    expect((document.activeElement as HTMLInputElement).value).toBe('X');
    expect((document.activeElement as HTMLInputElement).getAttribute('data-opcao-index')).toBe('2');
  });
  it('Substituir: troca as atuais', async () => {
    await ateConflito();
    fireEvent.click(screen.getByLabelText(/Substituir as 2 opções atuais/));
    await act(async () => fireEvent.click(confirmar()));
    expect(estado.atual).toEqual({ opcoes: ['X', 'Y'], notas: [9, 8], selecao: 'MULTIPLA', modoExibicao: 'LISTA' });
    expect((document.activeElement as HTMLInputElement).value).toBe('X');
  });
  it('opções continuam editáveis depois de importar', async () => {
    await ateConflito();
    await act(async () => fireEvent.click(confirmar()));
    const input = document.querySelector<HTMLInputElement>('[data-opcao-index="3"]')!;
    fireEvent.change(input, { target: { value: 'Y editado' } });
    expect(estado.atual!.opcoes).toEqual(['A', 'B', 'X', 'Y editado']);
  });
  it('Cancelar não muda nada; Esc fecha', async () => {
    await ateConflito();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByTestId('importar-opcoes-dialog')).toBeNull();
    expect(estado.mudancas).toBe(0);
    await abrir();
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(screen.queryByTestId('importar-opcoes-dialog')).toBeNull();
  });
});
