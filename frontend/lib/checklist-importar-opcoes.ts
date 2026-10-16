/**
 * 294 · Importar lista de opções (múltipla escolha) — regras puras, sem DOM e sem biblioteca de planilha.
 * A leitura do arquivo (XLSX/XLS/CSV/TXT) entrega uma matriz de valores de célula; aqui só há validação.
 */
import {
  MAX_OPCOES_MULTIPLA_ESCOLHA,
  MAX_TAMANHO_OPCAO_MULTIPLA_ESCOLHA,
  parseMultiplaEscolhaOpcoes,
  type ChecklistMultiplaEscolhaOpcoes,
} from '@/lib/checklist-item-opcoes';

export { MAX_OPCOES_MULTIPLA_ESCOLHA };

export type FinalidadeImportacao = 'VISTORIA' | 'CHAMADO' | 'DOCUMENTO_AVULSO';
export type OpcaoImportada = { nome: string; nota: number | null; linha: number };
export type ErroImportacao = { linha: number | null; mensagem: string };
export type ResultadoImportacao = {
  opcoes: OpcaoImportada[];
  erros: ErroImportacao[];
  vazias: number;
  avisos: string[];
};
export type Celula = string | number | boolean | null | undefined;

export const MENSAGEM_CABECALHO_AUSENTE =
  'Cabeçalho não encontrado: a primeira linha precisa da coluna "Opção". Use "Baixar modelo" para ver o formato.';

export const FINALIDADE_LABEL: Record<FinalidadeImportacao, string> = {
  VISTORIA: 'vistoria',
  CHAMADO: 'execução de chamado',
  DOCUMENTO_AVULSO: 'documento avulso',
};

/** "Opção", "opcao", "OPÇÃO " → "opcao". */
export function normalizarCabecalho(valor: Celula) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const COLUNA_OPCAO = new Set(['opcao', 'opcoes']);
const COLUNA_NOTA = new Set(['nota', 'notas']);

function texto(valor: Celula) {
  if (valor == null) return '';
  return String(valor).trim();
}

function linhaVazia(linha: Celula[] | undefined) {
  return !linha || linha.every((c) => texto(c) === '');
}

/** Nota 0–10; aceita vírgula decimal. `undefined` = inválida. */
export function lerNota(valor: Celula): number | null | undefined {
  if (typeof valor === 'number') return Number.isFinite(valor) && valor >= 0 && valor <= 10 ? valor : undefined;
  const bruto = texto(valor);
  if (!bruto) return null;
  const normal = bruto.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normal)) return undefined;
  const n = Number(normal);
  return n >= 0 && n <= 10 ? n : undefined;
}

type Analisador = { resultado: ResultadoImportacao; inicio: number; processar: (i: number) => void; finalizar: () => ResultadoImportacao };

function criarAnalisador(
  linhas: Celula[][],
  finalidade: FinalidadeImportacao,
  opts: { linhaInicial?: number; permitirSemCabecalho?: boolean },
): Analisador | ResultadoImportacao {
  const base = opts.linhaInicial ?? 1;
  const resultado: ResultadoImportacao = { opcoes: [], erros: [], vazias: 0, avisos: [] };
  const iCab = linhas.findIndex((l) => !linhaVazia(l));
  if (iCab < 0) {
    resultado.erros.push({ linha: null, mensagem: 'O arquivo está vazio.' });
    return resultado;
  }
  resultado.vazias += iCab;
  const cab = linhas[iCab].map(normalizarCabecalho);
  let colOpcao = cab.findIndex((c) => COLUNA_OPCAO.has(c));
  let colNota = cab.findIndex((c) => COLUNA_NOTA.has(c));
  let inicio = iCab + 1;
  if (colOpcao < 0) {
    if (!opts.permitirSemCabecalho) {
      resultado.erros.push({ linha: null, mensagem: MENSAGEM_CABECALHO_AUSENTE });
      return resultado;
    }
    colOpcao = 0;
    colNota = -1;
    inicio = iCab;
  }
  const usaNota = finalidade === 'VISTORIA';
  if (colNota >= 0 && !usaNota) {
    resultado.avisos.push(
      `A coluna "Nota" foi ignorada: checklist de ${FINALIDADE_LABEL[finalidade]} não usa nota nem conformidade.`,
    );
  }
  const processar = (i: number) => {
    const linha = linhas[i];
    const numero = base + i;
    if (linhaVazia(linha)) {
      resultado.vazias++;
      return;
    }
    const nome = texto(linha[colOpcao]);
    if (!nome) {
      resultado.erros.push({ linha: numero, mensagem: `Linha ${numero}: opção sem nome.` });
      return;
    }
    if (nome.length > MAX_TAMANHO_OPCAO_MULTIPLA_ESCOLHA) {
      resultado.erros.push({
        linha: numero,
        mensagem: `Linha ${numero}: opção com mais de ${MAX_TAMANHO_OPCAO_MULTIPLA_ESCOLHA} caracteres.`,
      });
      return;
    }
    let nota: number | null = null;
    if (usaNota && colNota >= 0) {
      const lida = lerNota(linha[colNota]);
      if (lida === undefined) {
        resultado.erros.push({ linha: numero, mensagem: `Linha ${numero}: nota inválida (use um número de 0 a 10).` });
        return;
      }
      nota = lida;
    }
    resultado.opcoes.push({ nome, nota, linha: numero });
  };
  const finalizar = () => {
    if (resultado.opcoes.length > MAX_OPCOES_MULTIPLA_ESCOLHA) {
      resultado.erros.unshift({
        linha: null,
        mensagem: `O arquivo tem ${resultado.opcoes.length} opções; o limite é ${MAX_OPCOES_MULTIPLA_ESCOLHA} por pergunta.`,
      });
    }
    return resultado;
  };
  return { resultado, inicio, processar, finalizar };
}

/**
 * Analisa as linhas (matriz de células). `linhaInicial` é o número da 1ª linha no arquivo (1 = primeira).
 * `permitirSemCabecalho`: TXT sem a linha "Opção" — cada linha é uma opção.
 */
export function analisarLinhas(
  linhas: Celula[][],
  finalidade: FinalidadeImportacao,
  opts: { linhaInicial?: number; permitirSemCabecalho?: boolean } = {},
): ResultadoImportacao {
  const a = criarAnalisador(linhas, finalidade, opts);
  if (!('processar' in a)) return a;
  for (let i = a.inicio; i < linhas.length; i++) a.processar(i);
  return a.finalizar();
}

/** Mesma análise em lotes, cedendo a vez para a tela entre eles (arquivos grandes não travam a UI). */
export async function analisarLinhasEmLotes(
  linhas: Celula[][],
  finalidade: FinalidadeImportacao,
  opts: { linhaInicial?: number; permitirSemCabecalho?: boolean; lote?: number } = {},
): Promise<ResultadoImportacao> {
  const lote = opts.lote ?? 500;
  const a = criarAnalisador(linhas, finalidade, opts);
  if (!('processar' in a)) return a;
  for (let i = a.inicio; i < linhas.length; i++) {
    a.processar(i);
    if ((i - a.inicio + 1) % lote === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return a.finalizar();
}

/** CSV do Excel: BOM, separador ";" ou "," (detectado no cabeçalho), aspas com "" escapado, CRLF. */
export function lerCsv(conteudo: string): string[][] {
  const textoCsv = conteudo.replace(/^\uFEFF/, '');
  const primeira = textoCsv.split(/\r?\n/, 1)[0] ?? '';
  const sep = contarFora(primeira, ';') >= contarFora(primeira, ',') && contarFora(primeira, ';') > 0 ? ';' : ',';
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < textoCsv.length; i++) {
    const c = textoCsv[i];
    if (aspas) {
      if (c === '"') {
        if (textoCsv[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && textoCsv[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

function contarFora(linha: string, sep: string) {
  let n = 0;
  let aspas = false;
  for (const c of linha) {
    if (c === '"') aspas = !aspas;
    else if (c === sep && !aspas) n++;
  }
  return n;
}

/** TXT: uma opção por linha (BOM removido). */
export function lerTxt(conteudo: string): string[][] {
  const linhas = conteudo.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (linhas.length && linhas[linhas.length - 1] === '') linhas.pop();
  return linhas.map((l) => [l]);
}

/** Linhas do modelo XLSX conforme a finalidade. */
export function linhasModelo(finalidade: FinalidadeImportacao): Celula[][] {
  if (finalidade === 'VISTORIA') {
    return [
      ['Opção', 'Nota'],
      ['Conforme', 10],
      ['Parcialmente conforme', 5],
      ['Não conforme', 0],
      ['Não se aplica', ''],
    ];
  }
  return [['Opção'], ['Sim'], ['Não'], ['Não se aplica']];
}

/** Quantas opções preenchidas a pergunta já tem (as em branco não contam como "atuais"). */
export function opcoesAtuaisPreenchidas(opcoes: unknown) {
  return parseMultiplaEscolhaOpcoes(opcoes).opcoes.filter((o) => o.trim()).length;
}

export type ModoImportacao = 'adicionar' | 'substituir';

/**
 * Aplica a importação. Não muda seleção (única/múltipla) nem exibição. Em finalidades sem avaliação não gera notas.
 * Retorna a nova config e o índice da primeira opção importada (para o foco).
 */
export function aplicarImportacao(
  opcoesAtuais: unknown,
  importadas: OpcaoImportada[],
  modo: ModoImportacao,
  semAvaliacao: boolean,
): { config: ChecklistMultiplaEscolhaOpcoes; primeiraImportada: number } {
  const atual = parseMultiplaEscolhaOpcoes(opcoesAtuais);
  const notasAtuais = atual.notas ?? atual.opcoes.map(() => null);
  const mantidas =
    modo === 'adicionar'
      ? atual.opcoes.map((nome, i) => ({ nome, nota: notasAtuais[i] ?? null })).filter((o) => o.nome.trim())
      : [];
  const todas = [...mantidas, ...importadas.map((o) => ({ nome: o.nome, nota: semAvaliacao ? null : o.nota }))];
  const { notas: _descartada, ...semNotas } = atual;
  void _descartada;
  const config: ChecklistMultiplaEscolhaOpcoes = {
    ...semNotas,
    opcoes: todas.map((o) => o.nome),
    ...(semAvaliacao ? {} : { notas: todas.map((o) => o.nota) }),
  };
  return { config, primeiraImportada: mantidas.length };
}

/** Bloqueia "Adicionar ao final" se o total passar do limite. */
export function erroLimiteAoAdicionar(atuais: number, novas: number) {
  return atuais + novas > MAX_OPCOES_MULTIPLA_ESCOLHA
    ? `Adicionar ao final deixaria ${atuais + novas} opções; o limite é ${MAX_OPCOES_MULTIPLA_ESCOLHA}. Escolha Substituir ou reduza o arquivo.`
    : null;
}
