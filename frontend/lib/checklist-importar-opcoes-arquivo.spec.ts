import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { lerArquivoOpcoes, lerPlanilha } from './checklist-importar-opcoes-arquivo';
import { analisarLinhas } from './checklist-importar-opcoes';

function planilha(ws: XLSX.WorkSheet, bookType: XLSX.BookType = 'xlsx') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aba1');
  return XLSX.write(wb, { type: 'array', bookType }) as ArrayBuffer;
}

describe('294 · leitura de planilha', () => {
  it('fórmulas não são executadas: lê só o valor guardado na célula', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['Opção'], ['Guardado']]);
    ws.A2 = { t: 's', v: 'Guardado', f: 'CONCATENATE("Exec","utado")' };
    const [aba] = await lerPlanilha(planilha(ws));
    expect(aba.linhas).toEqual([['Opção'], ['Guardado']]);
  });
  it('XLS (BIFF8) também é lido', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['Opção', 'Nota'], ['Bom', 8]]);
    const abas = await lerPlanilha(planilha(ws, 'biff8'));
    expect(abas[0].linhas).toEqual([['Opção', 'Nota'], ['Bom', 8]]);
  });
  it('aba que começa mais abaixo: número da linha é o da planilha', async () => {
    const ws = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, [['Opção'], ['A']], { origin: 'A3' });
    const [aba] = await lerPlanilha(planilha(ws));
    const r = analisarLinhas([...aba.linhas, [''], ['', 'sem nome']], 'VISTORIA', { linhaInicial: aba.linhaInicial });
    expect(r.opcoes).toEqual([{ nome: 'A', nota: null, linha: 4 }]);
    expect(r.erros.map((e) => e.linha)).toEqual([aba.linhaInicial + aba.linhas.length + 1]);
  });
  it('arquivo com extensão não aceita é recusado', async () => {
    await expect(lerArquivoOpcoes(new File(['x'], 'a.pdf'))).rejects.toThrow('Formato não aceito. Use XLSX, XLS, CSV ou TXT.');
  });
});
