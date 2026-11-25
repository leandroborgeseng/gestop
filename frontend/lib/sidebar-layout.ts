/** 290: layout do topo da barra lateral (desktop). Só o estado recolhido muda. */
export function sidebarTopClass(collapsed: boolean): string {
  // Recolhida: o topo (60px) contém só o logo; o botão fica numa linha própria abaixo.
  return collapsed ? 'justify-center' : 'gap-2.5 px-3.5 pl-4';
}

export function sidebarLogoClass(collapsed: boolean): string {
  return collapsed ? 'h-9 w-auto max-h-9' : 'h-11 w-auto max-h-11';
}

export const sidebarToggleRowClass = 'flex h-11 shrink-0 items-center justify-center';

export function sidebarToggleLabel(collapsed: boolean): string {
  return collapsed ? 'Expandir menu' : 'Recolher menu';
}
