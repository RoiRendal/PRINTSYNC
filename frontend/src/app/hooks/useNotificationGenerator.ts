import { useEffect, useRef } from 'react';
import { useInventory } from '../stores/useInventoryStore';
import { useOrders } from '../stores/useOrderStore';
import { useNotifications } from '../providers/NotificationProvider';

export function useNotificationGenerator() {
  const { items } = useInventory();
  const { orders } = useOrders();
  const { addNotification, settings } = useNotifications();

  const prevStockRef = useRef<Record<string, number>>({});
  const prevOrderStatusesRef = useRef<Record<string, string>>({});
  const initialRef = useRef(true);

  // Stock level alerts
  useEffect(() => {
    if (!settings.stockAlertsEnabled) {
      prevStockRef.current = {};
      return;
    }

    const prevStock = prevStockRef.current;

    for (const item of items) {
      const prev = prevStock[item.id];
      const isLow = item.stock <= item.reorderLevel;

      if (initialRef.current && isLow) {
        // On initial load, only notify for critically low stock (0 or below reorder)
        if (item.stock <= item.reorderLevel) {
          addNotification({
            title: 'Low Stock Warning',
            message: `${item.name} is at ${item.stock} units (reorder level: ${item.reorderLevel}).`,
            type: 'stock',
            link: '/inventory',
          });
        }
      } else if (prev !== undefined && prev > item.reorderLevel && item.stock <= item.reorderLevel) {
        // Stock just dropped to or below reorder level
        addNotification({
          title: 'Stock Level Critical',
          message: `${item.name} dropped to ${item.stock} units (reorder level: ${item.reorderLevel}).`,
          type: 'stock',
          link: '/inventory',
        });
      }

      prevStock[item.id] = item.stock;
    }
  }, [items, settings.stockAlertsEnabled, addNotification]);

  // Order status alerts
  useEffect(() => {
    const prevStatuses = prevOrderStatusesRef.current;

    for (const order of orders) {
      const prevStatus = prevStatuses[order.id];

      if (!initialRef.current && prevStatus && prevStatus !== order.status) {
        addNotification({
          title: 'Order Status Updated',
          message: `Order #${order.id} for ${order.customer} moved from "${prevStatus}" to "${order.status}".`,
          type: 'order',
          link: '/orders',
        });
      }

      prevStatuses[order.id] = order.status;
    }
  }, [orders, addNotification]);

  useEffect(() => {
    initialRef.current = false;
  }, []);
}
