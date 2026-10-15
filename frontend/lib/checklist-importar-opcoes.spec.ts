import { describe, expect, it } from 'vitest';
import {
  analisarLinhas,
  analisarLinhasEmLotes,
  aplicarImportacao,
  erroLimiteAoAdicionar,
  lerCsv,
  lerNota,
  lerTxt,
  linhasModelo,
  MAX_OPCOES_MULTIPLA_ESCOLHA,
  MENSAGEM_CABECALHO_AUSENTE,
  normalizarCabecalho,
  opcoesAtuaisPreenchidas,
} from './checklist-importar-opcoes';
import { MAX_OPCOES_MULTIPLA_ESCOLHA as MAX_SAVE, validateItemOpcoes } from './checklist-item-opcoes';
import { decodificarTexto, tipoDoArquivo } from './checklist-importar-opcoes-arquivo';

const nomes = (r: { opcoes: Array<{ nome: string }> }) => r.opcoes.map((o) => o.nome);

describe('294 · cabeçalho', () => {
  it('cabeçalho "Opções" (plural) é reconhecido como a coluna da opção', () => {
    const r = analisarLinhas([['Opções', 'Nota'], ['Bom', 8], ['Ruim', 2]], 'VISTORIA');
    expect(r.erros).toEqual([]);
    expect(r.opcoes).toEqual([
      { nome: 'Bom', nota: 8, linha: 2 },
      { nome: 'Ruim', nota: 2, linha: 3 },
    ]);
  });
  it('normaliza acento e caixa', () => {
    expect(['Opção', 'opcao', 'OPÇÃO ', ' Opções', 'NOTA'].map(normalizarCabecalho)).toEqual(['opcao', 'opcao', 'opcao', 'opcoes', 'nota']);
  });
  it('colunas em qualquer ordem', () => {
    const r = analisarLinhas([['NOTA', 'OPÇÃO'], [7, 'Bom'], ['3,5', 'Ruim']], 'VISTORIA');
    expect(r.opcoes).toEqual([
      { nome: 'Bom', nota: 7, linha: 2 },
      { nome: 'Ruim', nota: 3.5, linha: 3 },
    ]);
    expect(r.erros).toEqual([]);
  });
  it('sem cabeçalho: mensagem apontando o modelo e nenhuma opção', () => {
    const r = analisarLinhas([['Nome'], ['A']], 'VISTORIA');
    expect(r.opcoes).toEqual([]);
    expect(r.erros).toEqual([{ linha: null, mensagem: MENSAGEM_CABECALHO_AUSENTE }]);
    expect(MENSAGEM_CABECALHO_AUSENTE).toContain('Baixar modelo');
  });
  it('arquivo vazio', () => {
    expect(analisarLinhas([[''], []], 'VISTORIA').erros).toEqual([{ linha: null, mensagem: 'O arquivo está vazio.' }]);
  });
});

describe('294 · linhas', () => {
  it('ordem preservada, vazias ignoradas e contadas, número de linha do arquivo', () => {
    const r = analisarLinhas([['Opção'], ['C'], [''], ['A'], ['  '], ['B']], 'DOCUMENTO_AVULSO');
    expect(nomes(r)).toEqual(['C', 'A', 'B']);
    expect(r.opcoes.map((o) => o.linha)).toEqual([2, 4, 6]);
    expect(r.vazias).toBe(2);
  });
  it('linhaInicial desloca a numeração (aba começando mais abaixo)', () => {
    const r = analisarLinhas([['Opção', 'Nota'], ['', 5]], 'VISTORIA', { linhaInicial: 3 });
    expect(r.erros).toEqual([{ linha: 4, mensagem: 'Linha 4: opção sem nome.' }]);
  });
  it('opção sem nome e nota inválida listadas com a linha', () => {
    const r = analisarLinhas([['Opção', 'Nota'], ['A', 5], ['', 3], ['B', 11], ['C', 'abc'], ['D', '-1'], ['E', '']], 'VISTORIA');
    expect(nomes(r)).toEqual(['A', 'E']);
    expect(r.opcoes[1].nota).toBeNull();
    expect(r.erros.map((e) => e.mensagem)).toEqual([
      'Linha 3: opção sem nome.',
      'Linha 4: nota inválida (use um número de 0 a 10).',
      'Linha 5: nota inválida (use um número de 0 a 10).',
      'Linha 6: nota inválida (use um número de 0 a 10).',
    ]);
  });
  it('opção acima de 500 caracteres é erro com a linha', () => {
    const r = analisarLinhas([['Opção'], ['x'.repeat(501)], ['y'.repeat(500)]], 'VISTORIA');
    expect(r.erros).toEqual([{ linha: 2, mensagem: 'Linha 2: opção com mais de 500 caracteres.' }]);
    expect(r.opcoes).toHaveLength(1);
  });
  it('lerNota: vírgula decimal, limites 0 e 10', () => {
    expect([lerNota('0'), lerNota('10'), lerNota('7,25'), lerNota(9.5), lerNota(''), lerNota('10,1'), lerNota(Number.NaN)]).toEqual([0, 10, 7.25, 9.5, null, undefined, undefined]);
  });
});

describe('294 · Nota conforme a finalidade', () => {
  it('vistoria: Nota opcional (sem coluna → null)', () => {
    const r = analisarLinhas([['Opção'], ['A'], ['B']], 'VISTORIA');
    expect(r.opcoes.map((o) => o.nota)).toEqual([null, null]);
    expect(r.avisos).toEqual([]);
  });
  for (const [finalidade, rotulo] of [['DOCUMENTO_AVULSO', 'documento avulso'], ['CHAMADO', 'execução de chamado']] as const) {
    it(`${finalidade}: Nota ignorada com aviso; nota inválida não bloqueia`, () => {
      const r = analisarLinhas([['Opção', 'Nota'], ['A', 7], ['B', 'xx']], finalidade);
      expect(r.opcoes).toEqual([
        { nome: 'A', nota: null, linha: 2 },
        { nome: 'B', nota: null, linha: 3 },
      ]);
      expect(r.erros).toEqual([]);
      expect(r.avisos).toEqual([`A coluna "Nota" foi ignorada: checklist de ${rotulo} não usa nota nem conformidade.`]);
    });
  }
});

describe('294 · limite de 500', () => {
  const linhas = (n: number) => [['Opção'], ...Array.from({ length: n }, (_, i) => [`Op ${i + 1}`])];
  it('constante nomeada igual à do salvamento', () => {
    expect(MAX_OPCOES_MULTIPLA_ESCOLHA).toBe(500);
    expect(MAX_SAVE).toBe(500);
  });
  it('50 → 50, 200 → 200, 500 → 500 sem erro, na ordem', () => {
    for (const n of [50, 200, 500]) {
      const r = analisarLinhas(linhas(n), 'VISTORIA');
      expect(r.opcoes).toHaveLength(n);
      expect(r.opcoes[n - 1].nome).toBe(`Op ${n}`);
      expect(r.erros).toEqual([]);
    }
  });
  it('501 → erro de limite no topo', () => {
    const r = analisarLinhas(linhas(501), 'VISTORIA');
    expect(r.erros[0]).toEqual({ linha: null, mensagem: 'O arquivo tem 501 opções; o limite é 500 por pergunta.' });
  });
  it('em lotes dá o mesmo resultado', async () => {
    const l = [...linhas(1200), [''], ['', ''], ['Fim']];
    expect(await analisarLinhasEmLotes(l, 'VISTORIA', { lote: 100 })).toEqual(analisarLinhas(l, 'VISTORIA'));
  });
  it('salvar (front) recusa 501 opções preenchidas', () => {
    const opcoes = Array.from({ length: 501 }, (_, i) => `Op ${i}`);
    expect(validateItemOpcoes('MULTIPLA_ESCOLHA', { opcoes }, 'P', 'P1')).toBe('Item "P": no máximo 500 opções de múltipla escolha (há 501).');
    expect(validateItemOpcoes('MULTIPLA_ESCOLHA', { opcoes: opcoes.slice(0, 500) }, 'P', 'P1')).toBeNull();
    expect(validateItemOpcoes('MULTIPLA_ESCOLHA', { opcoes: ['ok', 'x'.repeat(501)] }, 'P', 'P1')).toBe('Item "P": a opção 2 passa de 500 caracteres.');
  });
  it('adicionar acima do limite é bloqueado', () => {
    expect(erroLimiteAoAdicionar(450, 50)).toBeNull();
    expect(erroLimiteAoAdicionar(450, 51)).toBe('Adicionar ao final deixaria 501 opções; o limite é 500. Escolha Substituir ou reduza o arquivo.');
  });
});

describe('294 · CSV e TXT', () => {
  it('CSV ; do Excel com BOM, aspas e CRLF', () => {
    expect(lerCsv('\uFEFFOpção;Nota\r\n"Bom; muito";8\r\n"Diz ""ok""";7\r\n')).toEqual([
      ['Opção', 'Nota'],
      ['Bom; muito', '8'],
      ['Diz "ok"', '7'],
    ]);
  });
  it('CSV com vírgula', () => {
    expect(lerCsv('opcao,nota\nA,1\n"B, C",2')).toEqual([
      ['opcao', 'nota'],
      ['A', '1'],
      ['B, C', '2'],
    ]);
  });
  it('CSV com mais "," que ";" no cabeçalho usa ","', () => {
    expect(lerCsv('Opção,Nota,Obs;extra\nA,1,x;y\n')).toEqual([
      ['Opção', 'Nota', 'Obs;extra'],
      ['A', '1', 'x;y'],
    ]);
  });
  it('CSV ; com nota decimal em vírgula', () => {
    const r = analisarLinhas(lerCsv('Opção;Nota\nA;7,5\n'), 'VISTORIA');
    expect(r.opcoes).toEqual([{ nome: 'A', nota: 7.5, linha: 2 }]);
  });
  it('TXT remove o BOM já na leitura', () => {
    expect(lerTxt('\uFEFFA\r\nB\n')).toEqual([['A'], ['B']]);
  });
  it('TXT: uma opção por linha, com ou sem cabeçalho, vazias ignoradas', () => {
    expect(nomes(analisarLinhas(lerTxt('\uFEFFOpção\nA\n\nB\n'), 'VISTORIA', { permitirSemCabecalho: true }))).toEqual(['A', 'B']);
    const sem = analisarLinhas(lerTxt('Primeira\r\nSegunda\r\n\r\nTerceira'), 'VISTORIA', { permitirSemCabecalho: true });
    expect(nomes(sem)).toEqual(['Primeira', 'Segunda', 'Terceira']);
    expect(sem.vazias).toBe(1);
    expect(sem.opcoes.map((o) => o.linha)).toEqual([1, 2, 4]);
  });
  it('decodifica UTF-8 com BOM e cai para Windows-1252', () => {
    expect(decodificarTexto(new Uint8Array([0xef, 0xbb, 0xbf, 0x4f, 0x70, 0xc3, 0xa7, 0xc3, 0xa3, 0x6f]))).toBe('Opção');
    expect(decodificarTexto(new Uint8Array([0x4f, 0x70, 0xe7, 0xe3, 0x6f]))).toBe('Opção');
  });
  it('tipos aceitos', () => {
    expect(['a.XLSX', 'b.xls', 'c.csv', 'd.txt', 'e.pdf'].map(tipoDoArquivo)).toEqual(['xlsx', 'xls', 'csv', 'txt', null]);
  });
});

describe('294 · modelo e aplicação', () => {
  it('modelo por finalidade', () => {
    expect(linhasModelo('VISTORIA')[0]).toEqual(['Opção', 'Nota']);
    expect(linhasModelo('VISTORIA').length).toBeGreaterThan(2);
    expect(linhasModelo('DOCUMENTO_AVULSO')[0]).toEqual(['Opção']);
    expect(linhasModelo('CHAMADO').every((l) => l.length === 1)).toBe(true);
  });
  const imp = [
    { nome: 'X', nota: 9, linha: 2 },
    { nome: 'Y', nota: null, linha: 3 },
  ];
  const atual = { opcoes: ['A', '', 'B'], notas: [1, null, 2], selecao: 'MULTIPLA', modoExibicao: 'LISTA' };
  it('adicionar ao final mantém as atuais (sem as em branco), seleção e exibição', () => {
    const r = aplicarImportacao(atual, imp, 'adicionar', false);
    expect(r.config).toEqual({ opcoes: ['A', 'B', 'X', 'Y'], notas: [1, 2, 9, null], selecao: 'MULTIPLA', modoExibicao: 'LISTA' });
    expect(r.primeiraImportada).toBe(2);
  });
  it('substituir troca tudo e mantém seleção/exibição', () => {
    const r = aplicarImportacao(atual, imp, 'substituir', false);
    expect(r.config).toEqual({ opcoes: ['X', 'Y'], notas: [9, null], selecao: 'MULTIPLA', modoExibicao: 'LISTA' });
    expect(r.primeiraImportada).toBe(0);
  });
  it('sem avaliação: nenhuma nota gerada', () => {
    const r = aplicarImportacao({ opcoes: ['A', 'B'], selecao: 'UNICA', modoExibicao: 'SELECT' }, imp, 'adicionar', true);
    expect(r.config).toEqual({ opcoes: ['A', 'B', 'X', 'Y'], selecao: 'UNICA', modoExibicao: 'SELECT' });
  });
  it('opções atuais preenchidas', () => {
    expect(opcoesAtuaisPreenchidas({ opcoes: ['', ''] })).toBe(0);
    expect(opcoesAtuaisPreenchidas({ opcoes: ['A', ' ', 'B'] })).toBe(2);
  });
});
