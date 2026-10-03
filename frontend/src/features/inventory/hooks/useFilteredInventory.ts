import { useMemo } from 'react';
import type { InventoryItem } from '../types';

/**
 * The stock list's derived data: the search-narrowed rows and the category list
 * the form offers.
 *
 * The three stock totals — total stock, stock value and low stock — used to be
 * computed here too, from the rows the page had loaded. That was only ever
 * correct while the catalogue fitted in one page of 20: the figures were a tally
 * of page 1, not of the branch. They now come from `GET /orders/summary`, summed
 * in the database over the whole table, and are rendered on the Workspace.
 */
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

  return { filteredItems, categories };
}
