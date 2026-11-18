/** #311 — contrato do deep-link para Vistorias realizadas por id único. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const VISTORIAS_REALIZADAS_HREF = '/vistorias';

export function hrefVistoriaRealizada(id: string): string {
  return `${VISTORIAS_REALIZADAS_HREF}?id=${encodeURIComponent(id)}`;
}

/** Lê `?id=` da query; aceita só UUID para não repassar lixo à API. */
export function lerIdVistoriaDaUrl(search: string): string | null {
  const id = new URLSearchParams(search).get('id')?.trim();
  return id && UUID_RE.test(id) ? id : null;
}
