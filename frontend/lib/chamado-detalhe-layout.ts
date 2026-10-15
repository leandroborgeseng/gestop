/**
 * 291: classes do detalhe do chamado. As classes-base são as da main (md ou maior não muda);
 * tudo o que é do celular usa o prefixo `max-md:` ou só aparece com `md:hidden`.
 */

/** Seção do detalhe: no celular ocupa a altura útil (100dvh − header − menu inferior). */
export const DETALHE_SECTION_MOBILE =
  'max-md:h-[calc(100dvh-var(--mobile-appbar-h)-var(--bottom-nav-h)-env(safe-area-inset-bottom))] max-md:max-h-none max-md:scroll-mt-[var(--mobile-appbar-h)]';

/** Área de rolagem: no celular é a única do card, com respiro acima do menu inferior. */
export const DETALHE_SCROLL_BASE = 'flex h-full flex-col p-0';
export const DETALHE_SCROLL_MOBILE =
  'max-md:overflow-y-auto max-md:overscroll-contain max-md:pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+12px)]';

/** Linha fixa (só no celular): código, status e "⋯", 48px. */
export const DETALHE_LINHA_FIXA =
  'sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line-2)] bg-[var(--surface)] pr-1 pl-3 md:hidden';
export const DETALHE_LINHA_FIXA_SOMBRA = 'shadow-[0_2px_6px_rgba(15,23,42,0.08)]';

/** Cabeçalho (tags, título, descrição, local): no celular rola junto com o conteúdo. */
export const DETALHE_CABECALHO_BASE = 'border-b border-[var(--line-2)] p-5';
export const DETALHE_CABECALHO_MOBILE = 'max-md:p-3';

/** Linha de ações/tags do desktop: escondida no celular (as ações vão para o "⋯"). */
export const DETALHE_ACOES_DESKTOP_BASE = 'flex flex-wrap items-start justify-between gap-3';
export const DETALHE_ACOES_DESKTOP_MOBILE = 'max-md:hidden';

/** Blocos: em md+ é a área que rola (como na main); no celular não rola por conta própria. */
export const DETALHE_BLOCOS_BASE = 'flex-1 space-y-5 overflow-y-auto p-5';
export const DETALHE_BLOCOS_MOBILE = 'max-md:flex-none max-md:space-y-3 max-md:overflow-visible max-md:p-3';
