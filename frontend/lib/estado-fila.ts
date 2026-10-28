/**
 * M1 (Designer): estado da fila de envio compartilhado entre o app de vistoria e o chip de conexão do cabeçalho.
 * O app publica pendências e o último sync; o cabeçalho só lê (sem depender da página estar aberta).
 */
const ULTIMO_SYNC_KEY = 'sigma.campo.ultimo-sync';

type EstadoFila = { pendentes: number | null; ultimoSyncEm: string | null };
let estado: EstadoFila = { pendentes: null, ultimoSyncEm: null };
const ouvintes = new Set<() => void>();

export function lerEstadoFila(): EstadoFila {
  return estado;
}

export function assinarEstadoFila(fn: () => void) {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

export function publicarEstadoFila(parcial: Partial<EstadoFila>) {
  estado = { ...estado, ...parcial };
  if (parcial.ultimoSyncEm) {
    try {
      window.localStorage.setItem(ULTIMO_SYNC_KEY, parcial.ultimoSyncEm);
    } catch {
      /* ignore */
    }
  }
  ouvintes.forEach((fn) => fn());
}

export function ultimoSyncSalvo(): string | null {
  try {
    return window.localStorage.getItem(ULTIMO_SYNC_KEY);
  } catch {
    return null;
  }
}

/** Texto e aria-label do chip. Offline nunca é "Online"/verde. */
export function rotuloConexao(online: boolean, pendentes: number) {
  const texto = online ? 'Online' : 'Offline';
  const envios = pendentes === 0 ? 'nenhum envio pendente' : `${pendentes} ${pendentes === 1 ? 'envio pendente' : 'envios pendentes'}`;
  return { texto, tom: online ? ('ok' as const) : ('alerta' as const), ariaLabel: `Conexão: ${online ? 'online' : 'offline'}, ${envios}. Ver detalhes` };
}
