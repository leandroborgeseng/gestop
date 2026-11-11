/**
 * 322 C-1: durante os cliques, o estado local manda.
 * O replace que nós mesmos fizemos volta como eco e não pode desfazer o clique seguinte.
 * Popstate e uma query que não escrevemos entram como navegação externa.
 */

export type DecisaoEco = {
  tipo: 'igual' | 'eco' | 'externa';
  nossas: string[];
};

const MEMORIA = 8;

export function registrarEscrita(nossas: readonly string[], canon: string) {
  const sem = nossas.filter((item) => item !== canon);
  const next = [...sem, canon];
  return next.length > MEMORIA ? next.slice(next.length - MEMORIA) : next;
}

export function decidirEcoDaUrl(opts: {
  canon: string;
  chave: string;
  nossas: readonly string[];
  popstate: boolean;
  /** Ainda há replace nosso que a URL não alcançou. */
  escritaPendente: boolean;
}): DecisaoEco {
  if (opts.canon === opts.chave) {
    return { tipo: 'igual', nossas: [...opts.nossas] };
  }
  if (opts.popstate) {
    return { tipo: 'externa', nossas: [...opts.nossas] };
  }
  if (opts.escritaPendente || opts.nossas.includes(opts.canon)) {
    return { tipo: 'eco', nossas: [...opts.nossas] };
  }
  return { tipo: 'externa', nossas: [...opts.nossas] };
}
