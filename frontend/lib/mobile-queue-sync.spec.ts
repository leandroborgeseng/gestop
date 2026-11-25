import { describe, expect, it } from 'vitest';
import { processarFilaSync } from './mobile-queue-sync';

describe('309/C4a · fila do app: 409 mantém o item intacto com o erro', () => {
  it('sucesso sai da fila; 409 fica intacto com a mensagem do servidor', async () => {
    const ok = { clientEventId: 'a', respostas: [{ itemId: 'i', fotos: ['f1'] }] };
    const recusado = { clientEventId: 'b', respostas: [{ itemId: 'i', fotos: ['f2', 'f3'] }] };
    const copia = structuredClone(recusado);
    const msg = 'Este checklist está inativo e não pode iniciar vistoria, documento ou aplicação nova. Ele foi inativado em 20/10/2026 14:00, antes do check-in desta vistoria (21/10/2026 09:15). A vistoria continua salva no aparelho.';
    const { restantes, erros } = await processarFilaSync([ok, recusado], async (item) => {
      if (item.clientEventId === 'b') throw new Error(msg);
    });
    expect(restantes).toEqual([copia]);
    expect(restantes[0]).toBe(recusado);
    expect(erros).toEqual([{ item: recusado, mensagem: msg }]);
  });
  it('falha de rede também não perde o item', async () => {
    const { restantes } = await processarFilaSync([{ id: 1 }], async () => { throw new TypeError('Failed to fetch'); });
    expect(restantes).toEqual([{ id: 1 }]);
  });
});
