/**
 * 322 C-2: Chamado, ChamadoTarefa, Documento, Fiscalizacao e CronogramaChecagem
 * usam `@default(uuid())` no Prisma. Id fora desse formato permanece na URL,
 * mostra o aviso e não dispara a busca.
 */

const UUID_PRISMA_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function idTemFormatoPrisma(id: string | null | undefined): id is string {
  return Boolean(id && UUID_PRISMA_RE.test(id));
}

/** Um segmento de path. `?` e `/` não quebram a rota. */
export function caminhoRegistro(prefixo: string, id: string) {
  return `${prefixo}/${encodeURIComponent(id)}`;
}

export function recusarIdForaDoPrisma<T>(id: string): Promise<T> | null {
  if (idTemFormatoPrisma(id)) return null;
  return Promise.reject(Object.assign(new Error('Registro não encontrado ou sem acesso'), { status: 404 }));
}

export async function buscarRegistroPorIdDaUrl<T>(
  id: string | null | undefined,
  buscar: (id: string) => Promise<T>,
): Promise<{ tipo: 'ausente' } | { tipo: 'formato' } | { tipo: 'ok'; data: T }> {
  if (!id) return { tipo: 'ausente' };
  if (!idTemFormatoPrisma(id)) return { tipo: 'formato' };
  return { tipo: 'ok', data: await buscar(id) };
}
