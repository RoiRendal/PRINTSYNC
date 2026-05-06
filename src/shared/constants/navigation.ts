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

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Orders', path: '/orders', icon: ClipboardList },
  { label: 'Inventory', path: '/inventory', icon: Box },
  { label: 'Point of Sale', path: '/pos', icon: ShoppingCart },
  { label: 'Finance', path: '/finance', icon: Banknote },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Users', path: '/users', icon: Users },
  { label: 'Settings', path: '/settings', icon: SettingsIcon },
];

