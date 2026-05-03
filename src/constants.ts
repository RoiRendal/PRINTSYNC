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

export const APP_NAME = 'PRINTSYNC';
export const BUSINESS_NAME = 'IC Printing Services';

export const MOCK_ORDERS = [
  { id: 'ORD-001', customer: 'John Doe', item: 'Custom T-Shirt', quantity: 50, status: 'In Production', date: '2024-03-20', amount: 450.00 },
  { id: 'ORD-002', customer: 'Sarah Smith', item: 'Polo Shirts', quantity: 25, status: 'Pending', date: '2024-03-21', amount: 625.00 },
  { id: 'ORD-003', customer: 'Tech Corp', item: 'Jackets', quantity: 15, status: 'Ready for Pickup', date: '2024-03-19', amount: 1200.00 },
  { id: 'ORD-004', customer: 'Local Team', item: 'Jersey Uniforms', quantity: 30, status: 'Designing', date: '2024-03-22', amount: 1500.00 },
];

export const MOCK_INVENTORY = [
  { id: 'INV-001', name: 'Premium Cotton T-shirt (Black)', category: 'Apparel', stock: 150, reorderLevel: 50, price: 5.50 },
  { id: 'INV-002', name: 'Premium Cotton T-shirt (White)', category: 'Apparel', stock: 200, reorderLevel: 50, price: 5.20 },
  { id: 'INV-003', name: 'Pique Polo (Navy)', category: 'Apparel', stock: 85, reorderLevel: 30, price: 8.50 },
  { id: 'INV-004', name: 'Sport Mesh Jersey', category: 'Apparel', stock: 45, reorderLevel: 40, price: 12.00 },
  { id: 'INV-005', name: 'Heavyweight Hoodie', category: 'Outerwear', stock: 120, reorderLevel: 25, price: 15.00 },
];

export const COLORS = {
  accent: '#141414',
  bg: '#F5F5F5',
  card: '#FFFFFF',
  textMuted: '#6B7280',
  border: '#E5E7EB',
};

export const MOCK_FINANCIAL_RECORDS = [
  { id: 'FIN-001', date: '2024-03-24', type: 'Income', category: 'Screen Printing', description: 'Order #ORD-001 - Custom T-Shirts', amount: 45000 },
  { id: 'FIN-002', date: '2024-03-23', type: 'Expense', category: 'Material', description: 'Pigment Ink Bulk Purchase', amount: 2450 },
  { id: 'FIN-003', date: '2024-03-22', type: 'Expense', category: 'Rent', description: 'Monthly Station Rent', amount: 5000 },
  { id: 'FIN-004', date: '2024-03-21', type: 'Income', category: 'DTF Printing', description: 'Order #ORD-002 - Polo Shirts', amount: 25000 },
  { id: 'FIN-005', date: '2024-03-20', type: 'Expense', category: 'Inventory', description: 'Blank Apparel Restock', amount: 12200 },
  { id: 'FIN-006', date: '2024-03-19', type: 'Income', category: 'Embroidery', description: 'Order #ORD-003 - Jackets', amount: 18000 },
  { id: 'FIN-007', date: '2024-03-18', type: 'Expense', category: 'Utilities', description: 'Electricity and Water Bill', amount: 1200 },
  { id: 'FIN-008', date: '2024-03-17', type: 'Income', category: 'Sublimation', description: 'Order #ORD-004 - Jersey Uniforms', amount: 32000 },
];

export const MOCK_DESIGNS = [
  { 
    id: 'DSG-001', 
    name: 'Vintage Skyline', 
    category: 'Retro', 
    imageUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop',
    createdAt: '2024-03-01',
    tags: ['City', 'Vintage', 'Art']
  },
  { 
    id: 'DSG-002', 
    name: 'Geometric Minimal', 
    category: 'Abstract', 
    imageUrl: 'https://images.unsplash.com/photo-1574169208507-84376144848b?q=80&w=800&auto=format&fit=crop',
    createdAt: '2024-03-05',
    tags: ['Simple', 'Modern']
  },
  { 
    id: 'DSG-003', 
    name: 'Tropical Punch', 
    category: 'Summer', 
    imageUrl: 'https://images.unsplash.com/photo-1579546128583-a44a76178a0c?q=80&w=800&auto=format&fit=crop',
    createdAt: '2024-03-10',
    tags: ['Bright', 'Floral']
  },
  { 
    id: 'DSG-004', 
    name: 'Cyberpunk Neon', 
    category: 'Tech', 
    imageUrl: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=800&auto=format&fit=crop',
    createdAt: '2024-03-15',
    tags: ['Futuristic', 'Neon']
  },
];
