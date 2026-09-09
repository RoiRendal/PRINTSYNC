import type { Order } from '../types';

export function isCustomOrder(order: Order): boolean {
  if (order.isCustom) return true;
  if (order.designId) return true;
  return order.lineItems?.some((li) => li.designId) ?? false;
}
