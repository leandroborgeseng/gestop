/** 314: abrir a página completa do próprio (CCO) a partir de Administração > Próprios. */

export const ADMIN_PROPRIOS_VOLTAR = '/admin?aba=unidades';
const RETORNO_KEY = 'sigma.admin.proprios.retorno';

export type AdminProprioFiltros = {
  codigo: string;
  nome: string;
  origem: string;
  tipo: string;
  secretaria: string;
  status: string;
};

export type AdminProprioRetorno = { filtros: AdminProprioFiltros; scrollY: number };

export function hrefAbrirProprio(id: string, voltar: string = ADMIN_PROPRIOS_VOLTAR): string {
  return `/cco/unidades/${encodeURIComponent(id)}?voltar=${encodeURIComponent(voltar)}`;
}

/** Só aceita caminho interno ("/x"), nunca URL externa ou "//host". */
export function voltarSeguro(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('://') || v.includes('\\')) return null;
  return v;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function salvarRetornoAdminProprios(retorno: AdminProprioRetorno, s: StorageLike | null = storage()) {
  try {
    s?.setItem(RETORNO_KEY, JSON.stringify(retorno));
  } catch {
    // sem storage: volta sem restaurar
  }
}

/** Lê e apaga (restauração única). */
export function consumirRetornoAdminProprios(s: StorageLike | null = storage()): AdminProprioRetorno | null {
  try {
    const raw = s?.getItem(RETORNO_KEY);
    if (!raw) return null;
    s?.removeItem(RETORNO_KEY);
    const parsed = JSON.parse(raw) as Partial<AdminProprioRetorno>;
    const f = (parsed.filtros ?? {}) as Partial<AdminProprioFiltros>;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
      filtros: {
        codigo: str(f.codigo),
        nome: str(f.nome),
        origem: str(f.origem),
        tipo: str(f.tipo),
        secretaria: str(f.secretaria),
        status: str(f.status),
      },
      scrollY: typeof parsed.scrollY === 'number' && parsed.scrollY >= 0 ? parsed.scrollY : 0,
    };
  } catch {
    return null;
  }
}

/** 314: URL atual com `?aba=` (para history.replaceState ao trocar de aba na Administração). */
export function urlComAba(href: string, aba: string): string {
  const url = new URL(href);
  url.searchParams.set('aba', aba);
  return url.pathname + url.search + url.hash;
}

/** 314: aviso exibido no topo da página completa do próprio quando ele está inativo. */
export const AVISO_PROPRIO_INATIVO = 'Este próprio está inativo. As informações são apenas para consulta.';
