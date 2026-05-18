import {
  Activity,
  BarChart3,
  ClipboardList,
  LayoutGrid,
  MapPin,
  Plug,
  Settings,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  id: string;
  label: string;
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  mobilePrimary?: boolean;
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
    label: 'Campo',
    shortLabel: 'Campo',
    href: '/mobile',
    icon: MapPin,
    permission: 'fiscalizacoes.executar',
    mobilePrimary: true,
  },
  {
    id: 'ordens',
    label: 'Ordens de serviço',
    shortLabel: 'OS',
    href: '/ordens-servico',
    icon: Wrench,
    permission: 'chamados.gerenciar',
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
    id: 'admin',
    label: 'Administração',
    href: '/admin',
    icon: Settings,
    permission: 'secretarias.gerenciar',
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
  },
];

const MAX_BOTTOM_SLOTS = 4;

export function getVisibleNavItems(permissions: string[]) {
  return NAV_ITEMS.filter((item) => !item.permission || permissions.includes(item.permission));
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

/** @deprecated Use getMobileNav().primary */
export function getPrimaryNavItems(permissions: string[]) {
  return getMobileNav(permissions).primary;
}

/** @deprecated Use getMobileNav().secondary */
export function getSecondaryNavItems(permissions: string[]) {
  return getMobileNav(permissions).secondary;
}

export function isNavActive(pathname: string, href: string) {
  if (href === '/cco') {
    return pathname === '/cco' || pathname.startsWith('/cco/');
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export const MORE_NAV_ICON = LayoutGrid;
