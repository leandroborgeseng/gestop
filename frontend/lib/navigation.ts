import {
  Activity,
  BarChart3,
  CalendarDays,
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
  { title: 'Operação', itemIds: ['cco', 'mobile', 'chamados'] },
  { title: 'Gestão', itemIds: ['dashboard', 'cronograma', 'relatorios'] },
  { title: 'Configuração', itemIds: ['admin', 'checklists', 'integracoes'] },
];

const MAX_BOTTOM_SLOTS = 4;

export function getVisibleNavItems(permissions: string[]) {
  return NAV_ITEMS.filter((item) => !item.permission || permissions.includes(item.permission));
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

  if (visible.length <= MAX_BOTTOM_SLOTS) {
    return { primary: visible, secondary: [], hasMore: false };
  }

  const primaryCandidates = visible.filter((item) => item.mobilePrimary);
  const primary = (primaryCandidates.length > 0 ? primaryCandidates : visible).slice(0, MAX_BOTTOM_SLOTS - 1);
  const primaryIds = new Set(primary.map((item) => item.id));
  const secondary = visible.filter((item) => !primaryIds.has(item.id));

  return { primary, secondary, hasMore: secondary.length > 0 };
}

export function isNavActive(pathname: string, href: string) {
  if (href === '/cco') {
    return pathname === '/cco' || pathname.startsWith('/cco/');
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export const MORE_NAV_ICON = LayoutGrid;
