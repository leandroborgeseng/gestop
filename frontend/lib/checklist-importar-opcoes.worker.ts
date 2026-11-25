/// <reference lib="webworker" />
/** 294 · lê a planilha fora do main thread (a tela não trava em arquivos grandes). */
import { lerPlanilha } from '@/lib/checklist-importar-opcoes-planilha';

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  try {
    const abas = await lerPlanilha(e.data);
    (self as unknown as Worker).postMessage({ abas });
  } catch (err) {
    (self as unknown as Worker).postMessage({ erro: err instanceof Error ? err.message : 'Falha ao ler a planilha.' });
  }
};
