import { useMemo } from 'react';
import type { InventoryItem } from '../../inventory/types';

export function useFilteredProducts(inventory: InventoryItem[], searchTerm: string, activeCategory: string) {
  return useMemo(() => {
    return inventory.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [inventory, searchTerm, activeCategory]);
}
