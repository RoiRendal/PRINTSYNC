
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  reorderLevel: number;
  price: number;
}

export interface Order {
  id: string;
  customer: string;
  item: string;
  lineItems?: Array<{
    name: string;
    quantity: number;
    designId?: string;
  }>;
  quantity: number;
  status: 'Pending' | 'In Production' | 'Ready for Pickup' | 'Designing' | 'Completed' | 'Shipped';
  date: string;
  amount: number;
  designId?: string;
  notes?: string;
  isCustom?: boolean;
}

export interface CartItem extends InventoryItem {
  qty: number;
  isCustom?: boolean;
  designId?: string;
  notes?: string;
}

export interface FinancialRecord {
  id: string;
  date: string;
  type: 'Income' | 'Expense';
  category: string;
  description: string;
  amount: number;
}

export interface FinancialStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
}

export interface Transaction {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'Cash' | 'Card';
}

export interface Design {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  createdAt: string;
  tags: string[];
}

