import { useMemo } from 'react';
import type { InventoryItem } from '../types';

export interface InventoryStats {
  lowStock: number;
  totalStock: number;
  totalValue: number;
}

export function useFilteredInventory(items: InventoryItem[], searchTerm: string) {
  const filteredItems = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query),
    );
  }, [items, searchTerm]);

  const categories = useMemo(() => {
    return [...new Set([
      'Apparel',
      'Outerwear',
      'Accessories',
      'Consumables',
      'Supplies',
      'Equipment',
      'Packaging',
      ...items.map((item) => item.category),
    ])].filter(Boolean).sort();
  }, [items]);

  const inventoryStats = useMemo<InventoryStats>(() => {
    const lowStock = items.filter((item) => item.stock <= item.reorderLevel).length;
    const totalStock = items.reduce((sum, item) => sum + item.stock, 0);
    const totalValue = items.reduce((sum, item) => sum + item.stock * item.price, 0);
    return { lowStock, totalStock, totalValue };
  }, [items]);

  return { filteredItems, categories, inventoryStats };
}
