import { inventoryProductImagePublicUrl } from '../../../shared/constants/productImages';
import type { InventoryItem } from '../types';

export const MOCK_INVENTORY: InventoryItem[] = [
  { id: 'INV-001', name: 'Premium Cotton T-shirt (Black)', category: 'Apparel', stock: 150, reorderLevel: 50, price: 5.50, imageUrl: inventoryProductImagePublicUrl('INV-001') },
  { id: 'INV-002', name: 'Premium Cotton T-shirt (White)', category: 'Apparel', stock: 200, reorderLevel: 50, price: 5.20, imageUrl: inventoryProductImagePublicUrl('INV-002') },
  { id: 'INV-003', name: 'Pique Polo (Navy)', category: 'Apparel', stock: 85, reorderLevel: 30, price: 8.50, imageUrl: inventoryProductImagePublicUrl('INV-003') },
  { id: 'INV-004', name: 'Sport Mesh Jersey', category: 'Apparel', stock: 45, reorderLevel: 40, price: 12.00, imageUrl: inventoryProductImagePublicUrl('INV-004') },
  { id: 'INV-005', name: 'Heavyweight Hoodie', category: 'Outerwear', stock: 120, reorderLevel: 25, price: 15.00, imageUrl: inventoryProductImagePublicUrl('INV-005') },
  { id: 'INV-006', name: 'Plastisol Ink Starter Kit (CMYK)', category: 'Supplies', stock: 24, reorderLevel: 8, price: 48.00, imageUrl: inventoryProductImagePublicUrl('INV-006') },
  { id: 'INV-007', name: 'Aluminum Screen Frame 20" × 24"', category: 'Equipment', stock: 18, reorderLevel: 6, price: 22.50, imageUrl: inventoryProductImagePublicUrl('INV-007') },
  { id: 'INV-008', name: 'Lint-Free Microfiber Shop Towels (50-pack)', category: 'Supplies', stock: 40, reorderLevel: 12, price: 14.25, imageUrl: inventoryProductImagePublicUrl('INV-008') },
  { id: 'INV-009', name: 'Kraft Poly Mailers 10" × 13" (100-pack)', category: 'Packaging', stock: 65, reorderLevel: 20, price: 19.99, imageUrl: inventoryProductImagePublicUrl('INV-009') },
  { id: 'INV-010', name: 'Rechargeable LED Magnetic Work Light', category: 'Equipment', stock: 12, reorderLevel: 4, price: 32.00, imageUrl: inventoryProductImagePublicUrl('INV-010') },
];
