import type { Order } from '../../../shared/types/domain';

export function isCustomOrder(order: Order): boolean {
  if (order.isCustom) return true;
  if (order.designId) return true;
  return order.lineItems?.some((li) => li.designId) ?? false;
}
