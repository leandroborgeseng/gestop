/**
 * 322 C-1: durante os cliques, o estado local manda.
 * O replace que nós mesmos fizemos volta como eco e não pode desfazer o clique seguinte.
 * Popstate e o destino de uma travessia do histórico nunca são reescritos por esse eco.
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

let destinoTravessia: { path: string; busca: string } | null = null;
let observadorInstalado = false;

export function normalizarBusca(busca: string) {
  const bruta = busca.startsWith('?') ? busca.slice(1) : busca;
  return [...new URLSearchParams(bruta).entries()]
    .map(([chave, valor]) => `${chave}=${valor}`)
    .sort()
    .join('&');
}

function lerHref(href: string) {
  const absoluta = href.startsWith('http://') || href.startsWith('https://');
  const url = new URL(absoluta ? href : href.startsWith('/') ? href : `/?${href.replace(/^\?/, '')}`, 'http://local');
  return { path: url.pathname, busca: url.search.replace(/^\?/, '') };
}

/** Destino de um Voltar/Avançar. O efeito compara com isto mesmo se o flag do React se perder. */
export function registrarDestinoTravessia(href: string) {
  destinoTravessia = lerHref(href);
}

export function travessiaCorresponde(path: string, busca: string) {
  return (
    destinoTravessia !== null &&
    destinoTravessia.path === path &&
    normalizarBusca(destinoTravessia.busca) === normalizarBusca(busca)
  );
}

export function buscaDaTravessia(path: string) {
  if (destinoTravessia?.path !== path) return null;
  return destinoTravessia.busca;
}

export function concluirTravessia() {
  destinoTravessia = null;
}

export function cancelarTravessia() {
  destinoTravessia = null;
}

export function instalarObservadorDeTravessia() {
  if (observadorInstalado || typeof window === 'undefined') return;
  observadorInstalado = true;
  window.addEventListener(
    'popstate',
    () => registrarDestinoTravessia(`${window.location.pathname}${window.location.search}`),
    true,
  );
  const navegacao = (
    window as Window & {
      navigation?: {
        addEventListener: (
          tipo: 'navigate',
          fn: (evento: { navigationType: string; destination: { url: string } }) => void,
        ) => void;
      };
    }
  ).navigation;
  navegacao?.addEventListener('navigate', (evento) => {
    if (evento.navigationType !== 'traverse') return;
    try {
      registrarDestinoTravessia(evento.destination.url);
    } catch {
      registrarDestinoTravessia(`${window.location.pathname}${window.location.search}`);
    }
  });
}
