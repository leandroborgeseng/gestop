import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CirclePlay,
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  MapPin,
  Megaphone,
  PlusCircle,
  Plug,
  Settings,
} from 'lucide-react';

import { isAdministradorSistemaAtivo } from '@/lib/administrador-sistema';
import {
  hasAbrirChamadoAccess,
  hasMeusChamadosAccess,
  isMatrixPermissionKey,
  navItemAllowedByMatrix,
  screenHasVisualizarAccess,
} from '@/lib/permissions-matrix';

export type NavBadgeKey = 'chamados' | 'integracoes';

export type NavItem = {
  id: string;
  label: string;
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  /** Qualquer uma das permissões concede acesso ao item. */
  permissions?: string[];
  mobilePrimary?: boolean;
  badgeKey?: NavBadgeKey;
  /** Formulário de criação. O menu mostra; a tela inicial pula. */
  atalhoCriacao?: boolean;
  /** Lista de Chamados. Quando está no menu, a tela inicial não para em quem cede. */
  listaDeChamados?: boolean;
  /** Cede a entrada para a lista de Chamados quando as duas estão visíveis. */
  cedeParaListaDeChamados?: boolean;
};

export type NavGroup = {
  title: string;
  itemIds: string[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'cco',
    label: 'CCO',
    shortLabel: 'CCO',
    href: '/cco',
    icon: Activity,
    permission: 'dashboard.visualizar',
    mobilePrimary: true,
  },
  {
    id: 'mobile',
    label: 'Vistoria',
    shortLabel: 'Vistoria',
    href: '/mobile',
    icon: MapPin,
    permission: 'fiscalizacoes.executar',
    mobilePrimary: true,
  },
  {
    id: 'vistorias',
    label: 'Vistorias realizadas',
    shortLabel: 'Consulta',
    href: '/vistorias',
    icon: ClipboardCheck,
    permissions: ['fiscalizacoes.executar', 'dashboard.visualizar', 'chamados.gerenciar'],
  },
  {
    id: 'chamados',
    label: 'Chamados',
    shortLabel: 'Chamados',
    href: '/chamados',
    icon: Megaphone,
    permission: 'chamados.gerenciar',
    mobilePrimary: true,
    badgeKey: 'chamados',
    listaDeChamados: true,
  },
  {
    id: 'novo_chamado',
    label: 'Novo chamado',
    shortLabel: 'Novo',
    href: '/chamados/novo',
    icon: PlusCircle,
    permissions: ['chamados.abrir', 'chamados.gerenciar'],
    mobilePrimary: true,
    atalhoCriacao: true,
  },
  {
    id: 'meus_chamados',
    label: 'Meus chamados',
    shortLabel: 'Meus',
    href: '/meus-chamados',
    icon: Eye,
    permissions: ['meus_chamados.visualizar', 'chamados.abrir', 'chamados.gerenciar'],
    mobilePrimary: true,
    cedeParaListaDeChamados: true,
  },
  {
    id: 'execucao',
    label: 'Execução',
    shortLabel: 'Execução',
    href: '/execucao',
    icon: CirclePlay,
    permissions: ['chamados.gerenciar', 'chamados.executar'],
    mobilePrimary: true,
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Painel',
    href: '/dashboard',
    icon: BarChart3,
    permission: 'dashboard.visualizar',
    mobilePrimary: true,
  },
  {
    id: 'cronograma',
    label: 'Cronograma',
    shortLabel: 'Agenda',
    href: '/cronograma',
    icon: CalendarDays,
    permissions: ['cronograma.visualizar', 'dashboard.visualizar'],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    shortLabel: 'Relatórios',
    href: '/relatorios',
    icon: FileSpreadsheet,
    permission: 'dashboard.visualizar',
  },
  {
    id: 'documentos',
    label: 'Documentos',
    shortLabel: 'Docs',
    href: '/documentos',
    icon: FileText,
    permissions: [
      'documentos.visualizar',
      'documentos.administrar',
      'dashboard.visualizar',
      'chamados.gerenciar',
      'fiscalizacoes.executar',
    ],
  },
  {
    id: 'admin',
    label: 'Administração',
    href: '/admin',
    icon: Settings,
    permissions: ['usuarios.gerenciar', 'secretarias.gerenciar', 'unidades.gerenciar', 'permissoes.gerenciar'],
  },
  {
    id: 'checklists',
    label: 'Checklists',
    href: '/checklists',
    icon: ClipboardList,
    permission: 'checklists.gerenciar',
  },
  {
    id: 'integracoes',
    label: 'Integrações',
    href: '/integracoes',
    icon: Plug,
    permission: 'auditoria.visualizar',
    badgeKey: 'integracoes',
  },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operação',
    itemIds: ['cco', 'mobile', 'vistorias', 'novo_chamado', 'meus_chamados', 'chamados', 'execucao'],
  },
  { title: 'Gestão', itemIds: ['dashboard', 'cronograma', 'relatorios', 'documentos'] },
  { title: 'Configuração', itemIds: ['admin', 'checklists', 'integracoes'] },
];

/** Itens da barra inferior. A ordem é a de getMenuItemsInDisplayOrder, não a desta lista. */
const MOBILE_BAR_CORE = ['cco', 'mobile', 'novo_chamado', 'meus_chamados', 'chamados', 'execucao'] as const;

export type NavUser = { perfilAtivo?: { nome?: string } | null; perfis?: string[] } | null | undefined;

export function getVisibleNavItems(permissions: string[], user?: NavUser) {
  if (isAdministradorSistemaAtivo(user)) {
    return NAV_ITEMS;
  }

  const usesMatrix = permissions.some(isMatrixPermissionKey);

  return NAV_ITEMS.filter((item) => {
    if (usesMatrix) {
      const matrixAllowed = navItemAllowedByMatrix(item.id, permissions);
      if (matrixAllowed !== null) {
        return matrixAllowed;
      }
    }

    if (item.permissions?.length) {
      return item.permissions.some((permission) => permissions.includes(permission));
    }
    return !item.permission || permissions.includes(item.permission);
  });
}

export function getGroupedNavItems(permissions: string[], user?: NavUser) {
  const visible = getVisibleNavItems(permissions, user);
  const byId = new Map(visible.map((item) => [item.id, item]));

  return NAV_GROUPS.map((group) => ({
    title: group.title,
    items: group.itemIds.map((id) => byId.get(id)).filter(Boolean) as NavItem[],
  })).filter((group) => group.items.length > 0);
}

/**
 * Itens já filtrados, na ordem em que o menu lateral os mostra.
 * A barra inferior e a tela inicial leem esta lista — não a ordem interna de NAV_ITEMS.
 */
export function getMenuItemsInDisplayOrder(permissions: string[], user?: NavUser) {
  return getGroupedNavItems(permissions, user).flatMap((group) => group.items);
}

export function getMobileNav(permissions: string[], user?: NavUser) {
  const ordered = getMenuItemsInDisplayOrder(permissions, user);
  const core = new Set<string>(MOBILE_BAR_CORE);
  const primary = ordered.filter((item) => core.has(item.id));
  const primaryIds = new Set(primary.map((item) => item.id));
  const secondary = ordered.filter((item) => !primaryIds.has(item.id));

  // Menu "Mais" é nativo da conta (perfil, secretaria, sair) — sempre disponível.
  return { primary, secondary, hasMore: true };
}

/**
 * Percorre a ordem visível e pula formulários de criação.
 * Com a lista de Chamados no menu, Meus chamados não vira a entrada:
 * ele fica na frente de Chamados, e o perfil Sem CCO abre `/chamados`.
 * Sem tela restante, `/conta` — o mesmo fallback do menu vazio.
 */
export function hrefDaListaDoMenu(
  itens: readonly Pick<NavItem, 'href' | 'atalhoCriacao' | 'listaDeChamados' | 'cedeParaListaDeChamados'>[],
): string {
  const criacao = new Set(rotasDeCriacao());
  const semCriacao = itens.filter((item) => !criacao.has(item.href));
  const temListaDeChamados = semCriacao.some((item) => item.listaDeChamados);
  const destino = semCriacao.find((item) => !(temListaDeChamados && item.cedeParaListaDeChamados));
  return destino?.href ?? '/conta';
}

/** Rotas de criação derivadas da flag nos itens do menu. Não é uma segunda ordem. */
export function rotasDeCriacao(): string[] {
  return NAV_ITEMS.filter((item) => item.atalhoCriacao).map((item) => item.href);
}

export function getDefaultAuthenticatedHref(permissions: string[], user?: NavUser): string {
  return hrefDaListaDoMenu(getMenuItemsInDisplayOrder(permissions, user));
}

export function hasOperationalNavAccess(permissions: string[], user?: NavUser): boolean {
  return getVisibleNavItems(permissions, user).length > 0;
}

/** Usa a rota preferida se o perfil tiver acesso; senão, a primeira tela permitida. */
export function resolvePreferredHref(permissions: string[], preferredHref: string, user?: NavUser): string {
  const visible = getVisibleNavItems(permissions, user);
  // 314: compara só o caminho (ex.: "/admin?aba=unidades" vale como "/admin").
  const path = preferredHref.split(/[?#]/)[0];
  const allowed = visible.some((item) => path === item.href || path.startsWith(`${item.href}/`));
  if (allowed) return preferredHref;
  return getDefaultAuthenticatedHref(permissions, user);
}

export function isNavActive(pathname: string, href: string) {
  if (href === '/cco') {
    return pathname === '/cco' || pathname.startsWith('/cco/');
  }

  if (href === '/mobile') {
    return pathname === '/mobile' || pathname.startsWith('/mobile/');
  }

  if (href === '/vistorias') {
    return pathname === '/vistorias' || pathname.startsWith('/vistorias/');
  }

  if (href === '/chamados/novo') {
    return pathname === '/chamados/novo';
  }

  if (href === '/meus-chamados') {
    return pathname === '/meus-chamados' || pathname.startsWith('/meus-chamados/');
  }

  if (href === '/chamados') {
    return (
      pathname === '/chamados' ||
      (pathname.startsWith('/chamados/') &&
        !pathname.startsWith('/chamados/em-execucao') &&
        !pathname.startsWith('/chamados/novo'))
    );
  }

  if (href === '/execucao') {
    return pathname === '/execucao' || pathname.startsWith('/execucao/') || pathname.startsWith('/chamados/em-execucao');
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function hasChamadosGerenciar(permissions: string[]) {
  // Com matriz ativa, Triagem/Chamados exige visualizar da tela chamados — não basta Execução nem só Novo chamado.
  const hasMatrix = permissions.some(isMatrixPermissionKey);
  if (hasMatrix) {
    return screenHasVisualizarAccess('chamados', permissions);
  }
  return permissions.includes('chamados.gerenciar');
}

export function hasAbrirChamado(permissions: string[]) {
  return hasAbrirChamadoAccess(permissions);
}

export function hasMeusChamados(permissions: string[]) {
  return hasMeusChamadosAccess(permissions);
}

export function hasChamadosExecutar(permissions: string[]) {
  return permissions.includes('chamados.executar') || permissions.includes('chamados.gerenciar');
}

export function isExecucaoSectionActive(pathname: string) {
  return pathname === '/execucao' || pathname.startsWith('/execucao/') || pathname.startsWith('/chamados/em-execucao');
}

export const MORE_NAV_ICON = LayoutGrid;
