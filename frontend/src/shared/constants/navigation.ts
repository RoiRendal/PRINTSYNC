import {
  LayoutDashboard,
  Box,
  ShoppingCart,
  BarChart3,
  Users,
  UserCircle,
  ClipboardList,
  Settings as SettingsIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type PageAccessKey =
  | 'dashboard'
  | 'orders'
  | 'inventory'
  | 'pos'
  | 'analytics'
  | 'customers'
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
  'analytics',
  'customers',
  'users',
  'settings',
];

export const STAFF_PAGE_ACCESS: PageAccessKey[] = ['orders', 'pos', 'inventory', 'customers'];

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { key: 'orders', label: 'Orders', path: '/orders', icon: ClipboardList },
  { key: 'inventory', label: 'Inventory', path: '/inventory', icon: Box },
  { key: 'pos', label: 'Point of Sale', path: '/pos', icon: ShoppingCart },
  { key: 'analytics', label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { key: 'customers', label: 'Customers', path: '/customers', icon: UserCircle },
  { key: 'users', label: 'Users', path: '/users', icon: Users },
  { key: 'settings', label: 'Settings', path: '/settings', icon: SettingsIcon },
];

export function getPageAccessKey(path: string): PageAccessKey | undefined {
  const normalizedPath = path === '' ? '/' : path;
  return NAV_ITEMS.find((item) => item.path === normalizedPath)?.key;
}
