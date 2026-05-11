import {
  LayoutDashboard,
  Box,
  ShoppingCart,
  Banknote,
  BarChart3,
  Users,
  ClipboardList,
  Settings as SettingsIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type PageAccessKey =
  | 'dashboard'
  | 'orders'
  | 'inventory'
  | 'pos'
  | 'finance'
  | 'analytics'
  | 'users'
  | 'settings';

export interface NavItem {
  key: PageAccessKey;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

export const ADMIN_PAGE_ACCESS: PageAccessKey[] = [
  'dashboard',
  'orders',
  'inventory',
  'pos',
  'finance',
  'analytics',
  'users',
  'settings',
];

export const STAFF_PAGE_ACCESS: PageAccessKey[] = ['orders', 'pos'];

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { key: 'orders', label: 'Orders', path: '/orders', icon: ClipboardList },
  { key: 'inventory', label: 'Inventory', path: '/inventory', icon: Box },
  { key: 'pos', label: 'Point of Sale', path: '/pos', icon: ShoppingCart },
  { key: 'finance', label: 'Finance', path: '/finance', icon: Banknote },
  { key: 'analytics', label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { key: 'users', label: 'Users', path: '/users', icon: Users },
  { key: 'settings', label: 'Settings', path: '/settings', icon: SettingsIcon },
];

