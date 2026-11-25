/**
 * 322 L1: o que o usuário escolheu para ver fica na query.
 * Valor padrão é omitido. Valor inválido é ignorado e a URL canônica o remove.
 * Secretaria e perfil ativo nunca são lidos da URL.
 */

export const AVISO_REGISTRO_URL = 'Registro não encontrado ou sem acesso';

const DATA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function dataIsoValida(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = DATA_RE.exec(raw.trim());
  if (!match) return null;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function mesIsoValido(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = MES_RE.exec(raw.trim());
  return match ? `${match[1]}-${match[2]}` : null;
}

export function mesAtualIso(agora = new Date()) {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

export function hojeIso(agora = new Date()) {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

/** Domingo da semana local, no mesmo critério do calendário de programação. */
export function inicioSemanaIso(agora = new Date()) {
  const data = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  data.setDate(data.getDate() - data.getDay());
  return hojeIso(data);
}

export function idUrl(raw: string | null | undefined): string | null {
  const valor = raw?.trim() ?? '';
  if (!valor || valor.length > 80 || /[\s,]/.test(valor)) return null;
  return valor;
}

export function idsUrl(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const ids: string[] = [];
  for (const parte of raw.split(',')) {
    const id = idUrl(parte);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function enumUrl<T extends string>(raw: string | null | undefined, permitidos: readonly T[]): T | null {
  if (!raw) return null;
  const norm = raw.trim().toLowerCase();
  return permitidos.find((item) => item.toLowerCase() === norm) ?? null;
}

export function enumsUrl<T extends string>(raw: string | null | undefined, permitidos: readonly T[]): T[] {
  if (!raw) return [];
  const itens: T[] = [];
  for (const parte of raw.split(',')) {
    const item = enumUrl(parte, permitidos);
    if (item && !itens.includes(item)) itens.push(item);
  }
  return itens;
}

export function flagUrl(raw: string | null | undefined) {
  return raw === '1';
}

export function inteiroUrl(raw: string | null | undefined, min: number, max?: number): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  if (n < min) return null;
  if (max != null && n > max) return null;
  return n;
}

export function paramsIguais(a: URLSearchParams, b: URLSearchParams) {
  const norm = (sp: URLSearchParams) =>
    [...sp.entries()]
      .map(([chave, valor]) => `${chave}=${valor}`)
      .sort()
      .join('&');
  return norm(a) === norm(b);
}

export function hrefDe(path: string, params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Detalhe cobre a lista no celular (abaixo de `md`). Abrir o registro entra no histórico. */
export function detalheCobreLista() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

export function definirParam(params: URLSearchParams, chave: string, valor: string | null | undefined) {
  if (valor == null || valor === '') params.delete(chave);
  else params.set(chave, valor);
}
