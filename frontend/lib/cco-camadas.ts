/**
 * 299 — Estado das camadas do mapa do CCO (painel "Camadas").
 *
 * D-296c (TL): todos os usuários do mapa veem as camadas do Webmap, DESLIGADAS por padrão,
 * e a escolha vale só para a sessão (sessionStorage; nada é gravado no servidor nem como
 * configuração global). SIGMA (próprios e chamados) começa ligado; o calor é um modo dos
 * chamados (D-299d/P3) e fica no estado de modo do mapa, não aqui.
 *
 * Pensado para a 298 consumir: `webmapLigadas(estado)` devolve os ids `webmap:<id>` ligados,
 * na ordem em que foram ligados, para a camada sob demanda / viewport / cache.
 */
import type { MapaCamadaGrupo } from './types';

export const CCO_CAMADAS_STORAGE_KEY = 'sigma.cco.camadas.v1';

export const SIGMA_CAMADA_PROPRIOS = 'sigma:proprios';
export const SIGMA_CAMADA_CHAMADOS = 'sigma:chamados';
export const SIGMA_CAMADA_CALOR = 'sigma:calor';
export const SIGMA_CAMADAS_PADRAO = [SIGMA_CAMADA_PROPRIOS, SIGMA_CAMADA_CHAMADOS] as const;

export type CcoCamadasEstado = {
  /** Ids ligados: `sigma:*` e `webmap:<id>`. Webmap nunca entra no padrão. */
  ligadas: string[];
  /** Grupos expandidos no painel (`sigma`, `webmap`, `webmap-grupo:<id>`). */
  gruposAbertos: string[];
};

export function estadoCamadasPadrao(): CcoCamadasEstado {
  return { ligadas: [...SIGMA_CAMADAS_PADRAO], gruposAbertos: ['sigma'] }; // 300: Webmap QGIS recolhida por padrão (esboço UX)
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function soStrings(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;
}

/** Lê a escolha da sessão; qualquer coisa inválida volta ao padrão (Webmap desligado). */
export function lerCamadasSessao(store: Storage | null = storage()): CcoCamadasEstado {
  const padrao = estadoCamadasPadrao();
  if (!store) return padrao;
  try {
    const raw = store.getItem(CCO_CAMADAS_STORAGE_KEY);
    if (!raw) return padrao;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const ligadas = soStrings(parsed.ligadas);
    const gruposAbertos = soStrings(parsed.gruposAbertos);
    if (!ligadas) return padrao;
    return {
      ligadas: [...new Set(ligadas.filter((id) => id.startsWith('sigma:') || id.startsWith('webmap:')))],
      gruposAbertos: gruposAbertos ?? padrao.gruposAbertos,
    };
  } catch {
    return padrao;
  }
}

export function salvarCamadasSessao(estado: CcoCamadasEstado, store: Storage | null = storage()) {
  if (!store) return;
  try {
    store.setItem(CCO_CAMADAS_STORAGE_KEY, JSON.stringify(estado));
  } catch {
    /* cota/privado: a escolha só não persiste */
  }
}

export function camadaLigada(estado: CcoCamadasEstado, id: string) {
  return estado.ligadas.includes(id);
}

export function alternarCamada(estado: CcoCamadasEstado, id: string, ligar?: boolean): CcoCamadasEstado {
  const atual = camadaLigada(estado, id);
  const alvo = ligar ?? !atual;
  if (alvo === atual) return estado;
  return { ...estado, ligadas: alvo ? [...estado.ligadas, id] : estado.ligadas.filter((x) => x !== id) };
}

export function alternarGrupoAberto(estado: CcoCamadasEstado, grupo: string): CcoCamadasEstado {
  const aberto = estado.gruposAbertos.includes(grupo);
  return {
    ...estado,
    gruposAbertos: aberto ? estado.gruposAbertos.filter((g) => g !== grupo) : [...estado.gruposAbertos, grupo],
  };
}

/** "Desligar todas": desliga SIGMA e Webmap (o modo calor é desligado pela página). */
export function desligarTodas(estado: CcoCamadasEstado): CcoCamadasEstado {
  return { ...estado, ligadas: [] };
}

/** 299-U2: "Desligar todas" desliga as do Webmap (o calor é desligado pela página); SIGMA fica como está. */
export function desligarWebmap(estado: CcoCamadasEstado): CcoCamadasEstado {
  return { ...estado, ligadas: estado.ligadas.filter((id) => !id.startsWith('webmap:')) };
}

/** Para a 298: ids `webmap:<id>` ligados (ordem de ligação), opcionalmente só os que existem na árvore. */
export function webmapLigadas(estado: CcoCamadasEstado, arvore?: MapaCamadaGrupo[] | null): string[] {
  const ids = estado.ligadas.filter((id) => id.startsWith('webmap:'));
  if (!arvore) return ids;
  const existentes = new Set(arvore.flatMap((g) => g.camadas.map((c) => c.id)));
  return ids.filter((id) => existentes.has(id));
}

/** Selo do botão Camadas: camadas ligadas além do padrão (Webmap ligadas + SIGMA fora do padrão). */
export function contarCamadasAlemDoPadrao(estado: CcoCamadasEstado, calorLigado = false): number {
  const webmap = webmapLigadas(estado).length;
  const sigmaDesligadas = SIGMA_CAMADAS_PADRAO.filter((id) => !camadaLigada(estado, id)).length;
  return webmap + (calorLigado ? 1 : 0) + sigmaDesligadas;
}

export function resumoGrupo(estado: CcoCamadasEstado, grupo: MapaCamadaGrupo) {
  const total = grupo.camadas.length;
  const ligadas = grupo.camadas.filter((c) => camadaLigada(estado, c.id)).length;
  const marcado: boolean | 'mixed' = ligadas === 0 ? false : ligadas === total ? true : 'mixed';
  return { ligadas, total, texto: `${ligadas}/${total}`, marcado };
}

/** 300 W16: normaliza para busca (sem acento, sem caixa). */
export function normalizarBusca(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** 300 W16: grupos com as camadas cujo nome (ou o do grupo) contém o termo. Termo vazio => árvore inteira. */
export function filtrarArvore(arvore: MapaCamadaGrupo[], termo: string): MapaCamadaGrupo[] {
  const t = normalizarBusca(termo);
  if (!t) return arvore;
  return arvore
    .map((g) => (normalizarBusca(g.titulo).includes(t) ? g : { ...g, camadas: g.camadas.filter((c) => normalizarBusca(c.nomeOriginal).includes(t)) }))
    .filter((g) => g.camadas.length > 0);
}
