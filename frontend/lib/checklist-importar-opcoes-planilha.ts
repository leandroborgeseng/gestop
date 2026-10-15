/**
 * 294 · Planilha (XLSX/XLS) → abas com a matriz de VALORES das células.
 * SheetJS (CDN oficial, 0.20.3): cellFormula:false e bookVBA:false — nenhuma fórmula ou macro é executada.
 * Módulo sem referência ao worker, para o worker poder importá-lo sem ciclo.
 */
import type { Celula } from '@/lib/checklist-importar-opcoes';

export type Aba = { nome: string; linhas: Celula[][]; linhaInicial: number };

/** Planilha → abas com a matriz de valores. Roda no worker (ou no main thread como fallback). */
export async function lerPlanilha(buffer: ArrayBuffer): Promise<Aba[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(new Uint8Array(buffer), {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    bookVBA: false,
    sheetStubs: false,
  });
  return wb.SheetNames.map((nome) => {
    const ws = wb.Sheets[nome];
    const ref = ws?.['!ref'];
    const inicio = ref ? XLSX.utils.decode_range(ref).s.r : 0;
    const linhas = ws ? (XLSX.utils.sheet_to_json<Celula[]>(ws, { header: 1, raw: true, defval: '', blankrows: true }) as Celula[][]) : [];
    return { nome, linhas, linhaInicial: inicio + 1 };
  });
}

