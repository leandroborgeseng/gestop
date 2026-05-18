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

export function getVisibleNavItems(permissions: string[]) {
  return NAV_ITEMS.filter((item) => !item.permission || permissions.includes(item.permission));
}

export function getPrimaryNavItems(permissions: string[]) {
  const visible = getVisibleNavItems(permissions);
  const primary = visible.filter((item) => item.mobilePrimary);

  if (primary.length <= 4) {
    return primary;
  }

  return primary.slice(0, 3);
}

export function getSecondaryNavItems(permissions: string[]) {
  const visible = getVisibleNavItems(permissions);
  const primary = getPrimaryNavItems(permissions);
  const primaryIds = new Set(primary.map((item) => item.id));

  return visible.filter((item) => !primaryIds.has(item.id));
}

export const MORE_NAV_ICON = LayoutGrid;
