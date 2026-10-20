/**
 * 296 / D-296d — chave estável da camada Webmap (qgis2web não tem ID estável).
 * Regras: remove só o índice de exportação final `_<n>` e os tokens de contagem/medida
 * (`45UNID`, `(45 UNID.)`, `7530210M`, `m²`, `KM`, `HA`); mantém números internos (`ETE 2`).
 * Maiúsculas, sem acentos, espaços/underscores colapsados.
 */
const UNIT = '(?:UNID\\.?|UN\\.?|M²|M2|M|KM²|KM2|KM|HA)';

export function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function collapse(value: string) {
  return stripAccents(value)
    .toUpperCase()
    .replace(/[\s_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Nome base a partir do título exibido (popuplayertitle), ex.: "CRECHE_PRE_ESCOLA (45 UNID.)". */
export function nomeBaseDoTitulo(titulo: string) {
  let t = titulo.replace(/<[^>]*>/g, ' ').trim();
  // parêntese final só com contagem/medida: "(252 UNID. / 75.302,10 M²)"
  t = t.replace(new RegExp(`\\s*\\((?:\\s*[\\d.,]+\\s*${UNIT}\\s*/?)+\\s*\\)\\s*$`, 'i'), '');
  return collapse(t);
}

/** Nome base a partir do nome da variável/arquivo qgis2web, ex.: "CRECHE_PRE_ESCOLA45UNID_78". */
export function nomeBaseDaVariavel(variavel: string) {
  let t = variavel.replace(/\.js$/i, '').replace(/_\d+$/, '');
  // sequência final de tokens de contagem/medida colados: 45UNID, 252UNID7530210M, 74479KM
  t = t.replace(/(?:\d+(?:UNID|KM2|KM|HA|M2|M))+$/i, '');
  return collapse(t);
}

export function nomeBase(titulo: string | null | undefined, variavel: string) {
  const fromTitle = titulo ? nomeBaseDoTitulo(titulo) : '';
  return fromTitle || nomeBaseDaVariavel(variavel);
}

export function chaveGrupo(tituloGrupo: string) {
  return collapse(tituloGrupo);
}

export function chaveCamada(tituloGrupo: string, base: string) {
  return `${chaveGrupo(tituloGrupo)}/${base}`;
}
