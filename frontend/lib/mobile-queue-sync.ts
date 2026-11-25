/**
 * Processa a fila offline item a item. Item que falha (ex.: 409 de checklist inativado antes do check-in)
 * continua na fila INTACTO, com a mensagem do servidor para o usuário: nenhum dado de campo é perdido.
 */
export async function processarFilaSync<T>(itens: readonly T[], enviar: (item: T) => Promise<unknown>) {
  const restantes: T[] = [];
  const erros: Array<{ item: T; mensagem: string }> = [];
  for (const item of itens) {
    try {
      await enviar(item);
    } catch (err) {
      restantes.push(item);
      erros.push({ item, mensagem: err instanceof Error ? err.message : 'Falha ao sincronizar um item.' });
    }
  }
  return { restantes, erros };
}
