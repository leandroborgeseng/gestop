import {
  Activity,
  BarChart3,
  CalendarDays,
  CirclePlay,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  LayoutGrid,
  MapPin,
  Megaphone,
  Plug,
  Settings,
  type LucideIcon,
} from 'lucide-react';

import type { NavBadgeKey } from '@/lib/nav-badges';

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
    permission: 'dashboard.visualizar',
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
    id: 'admin',
    label: 'Administração',
    href: '/admin',
    icon: Settings,
    permission: 'usuarios.gerenciar',
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
  { title: 'Operação', itemIds: ['cco', 'mobile', 'vistorias', 'chamados', 'execucao'] },
  { title: 'Gestão', itemIds: ['dashboard', 'cronograma', 'relatorios'] },
  { title: 'Configuração', itemIds: ['admin', 'checklists', 'integracoes'] },
];

/** Atalhos fixos na barra inferior mobile — Execução sempre incluído quando permitido. */
const MOBILE_BAR_CORE = ['cco', 'mobile', 'chamados', 'execucao'] as const;

export function getVisibleNavItems(permissions: string[]) {
  return NAV_ITEMS.filter((item) => {
    if (item.permissions?.length) {
      return item.permissions.some((permission) => permissions.includes(permission));
    }
    return !item.permission || permissions.includes(item.permission);
  });
}

export function getGroupedNavItems(permissions: string[]) {
  const visible = getVisibleNavItems(permissions);
  const byId = new Map(visible.map((item) => [item.id, item]));

  return NAV_GROUPS.map((group) => ({
    title: group.title,
    items: group.itemIds.map((id) => byId.get(id)).filter(Boolean) as NavItem[],
  })).filter((group) => group.items.length > 0);
}

export function getMobileNav(permissions: string[]) {
  const visible = getVisibleNavItems(permissions);
  const visibleById = new Map(visible.map((item) => [item.id, item]));

  const primary = MOBILE_BAR_CORE.map((id) => visibleById.get(id)).filter(Boolean) as NavItem[];

  if (visible.length <= primary.length) {
    return { primary, secondary: [], hasMore: false };
  }

  const primaryIds = new Set(primary.map((item) => item.id));
  const secondary = visible.filter((item) => !primaryIds.has(item.id));

  return { primary, secondary, hasMore: secondary.length > 0 };
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

  if (href === '/chamados') {
    return pathname === '/chamados' || (pathname.startsWith('/chamados/') && !pathname.startsWith('/chamados/em-execucao'));
  }

  if (href === '/execucao') {
    return pathname === '/execucao' || pathname.startsWith('/execucao/') || pathname.startsWith('/chamados/em-execucao');
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function hasChamadosGerenciar(permissions: string[]) {
  return permissions.includes('chamados.gerenciar');
}

export function hasChamadosExecutar(permissions: string[]) {
  return permissions.includes('chamados.executar') || permissions.includes('chamados.gerenciar');
}

export function isExecucaoSectionActive(pathname: string) {
  return pathname === '/execucao' || pathname.startsWith('/execucao/') || pathname.startsWith('/chamados/em-execucao');
}

export const MORE_NAV_ICON = LayoutGrid;
