/**
 * 294 · Leitura do arquivo para a importação de opções.
 * - XLSX/XLS: SheetJS (CDN oficial, 0.20.3), carregado sob demanda; lê só os VALORES das células
 *   (cellFormula:false, bookVBA:false) — nenhuma fórmula ou macro é executada.
 * - CSV/TXT: texto (UTF-8 com BOM; se não for UTF-8 válido, Windows-1252, padrão do Excel no Brasil).
 */
import { lerCsv, lerTxt, type Celula } from '@/lib/checklist-importar-opcoes';
import { lerPlanilha, type Aba } from '@/lib/checklist-importar-opcoes-planilha';

export { lerPlanilha, type Aba };

export type TipoArquivo = 'xlsx' | 'xls' | 'csv' | 'txt';
export type ArquivoLido = { tipo: TipoArquivo; abas: Aba[] };

export const EXTENSOES_ACEITAS = '.xlsx,.xls,.csv,.txt';

export function tipoDoArquivo(nome: string): TipoArquivo | null {
  const ext = nome.toLowerCase().split('.').pop() ?? '';
  return ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'txt' ? ext : null;
}

export function decodificarTexto(bytes: Uint8Array) {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  if (!utf8.includes('\uFFFD')) return utf8.replace(/^\uFEFF/, '');
  return new TextDecoder('windows-1252').decode(bytes);
}

async function lerPlanilhaSemTravar(buffer: ArrayBuffer): Promise<Aba[]> {
  if (typeof Worker !== 'undefined') {
    try {
      const worker = new Worker(new URL('./checklist-importar-opcoes.worker.ts', import.meta.url), { type: 'module' });
      return await new Promise<Aba[]>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent<{ abas?: Aba[]; erro?: string }>) => {
          worker.terminate();
          if (e.data.erro) reject(new Error(e.data.erro));
          else resolve(e.data.abas ?? []);
        };
        worker.onerror = (e) => {
          worker.terminate();
          reject(new Error(e.message || 'Falha ao ler a planilha.'));
        };
        worker.postMessage(buffer, [buffer]);
      });
    } catch {
      // sem worker (ambiente de teste ou bloqueio): lê no main thread
    }
  }
  return lerPlanilha(buffer);
}

export async function lerArquivoOpcoes(arquivo: File): Promise<ArquivoLido> {
  const tipo = tipoDoArquivo(arquivo.name);
  if (!tipo) throw new Error('Formato não aceito. Use XLSX, XLS, CSV ou TXT.');
  const buffer = await arquivo.arrayBuffer();
  if (tipo === 'xlsx' || tipo === 'xls') return { tipo, abas: await lerPlanilhaSemTravar(buffer) };
  const conteudo = decodificarTexto(new Uint8Array(buffer));
  const linhas = tipo === 'csv' ? lerCsv(conteudo) : lerTxt(conteudo);
  return { tipo, abas: [{ nome: arquivo.name, linhas, linhaInicial: 1 }] };
}

export async function baixarModeloOpcoes(linhas: Celula[][], nomeArquivo: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'Opções');
  XLSX.writeFile(wb, nomeArquivo);
}
