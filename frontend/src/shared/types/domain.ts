
/**
 * Compatibility exports for older imports.
 * New feature code should import types from its owning feature folder.
 */
export type { InventoryItem } from '../../features/inventory/types';
export type { Design } from '../../features/designs/types';
export type {
  CartItem,
  Order,
  OrderLineItem,
  OrderStatus,
  Transaction,
} from '../../features/orders/types';

