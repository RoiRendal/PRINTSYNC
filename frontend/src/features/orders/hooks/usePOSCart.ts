import { useCallback, useEffect, useState } from 'react';
import type { InventoryItem } from '../../inventory/types';
import type { CartItem, Order, OrderLineItem } from '../types';

/** What the till is being used for: a counter sale, or a job going into production. */
export type PosMode = 'retail' | 'custom';

export interface UsePOSCartOptions {
  /** Catalogue, used to clamp a quantity change to what is actually on the shelf. */
  inventory: InventoryItem[];
  /** The shop's configured VAT rate. The cart's editable rate starts here and follows it. */
  vatRate: number;
}

export interface POSCartController {
  cart: CartItem[];
  cartDiscount: number;
  /** Editable per sale, seeded from the shop's configured rate. */
  vatRatePercent: number;
  customerName: string;
  customerId: string | null;
  orderNotes: string;
  /** Set when this cart is an existing order being reworked, not a new sale. */
  editingOrderId: string | null;
  /**
   * The edited order's `updatedAt` as it was when this cart was hydrated.
   *
   * Captured at hydration rather than read from the store at save time on
   * purpose: a background refresh can replace the store's copy with a newer one,
   * and saving against *that* version would let this form overwrite the change
   * it was supposed to be protected from.
   */
  editingOrderVersion: string | null;
  isDesignModalOpen: boolean;
  setCustomerName: (name: string) => void;
  setCustomerId: (id: string | null) => void;
  setOrderNotes: (notes: string) => void;
  setCartDiscount: (discount: number) => void;
  setVatRatePercent: (rate: number) => void;
  addToCart: (product: InventoryItem, mode: PosMode) => void;
  removeFromCart: (cartIndex: number) => void;
  updateQty: (cartIndex: number, delta: number) => void;
  openDesignSelector: (cartIndex: number) => void;
  selectDesignForItem: (designId: string) => void;
  closeDesignSelector: () => void;
  /**
   * Loads an existing order into the cart so it can be reworked.
   *
   * This is the only place `editingOrderVersion` is ever set, and it takes the
   * value from the order handed to it — never from a later re-read of the store.
   */
  hydrateFromOrder: (order: Order, inventory: InventoryItem[]) => void;
  /** Empties the basket when the till switches between Retail and Custom. */
  resetForModeSwitch: () => void;
  /** Empties the basket on request, leaving any order being edited alone. */
  resetCart: () => void;
  /** Clears everything after a sale has been recorded. */
  clearAfterSale: () => void;
}

/**
 * Owns the basket and everything typed into it.
 *
 * Two invariants live here and nowhere else:
 *
 *   - **A line's quantity never exceeds what is on the shelf.** Clamped against
 *     the catalogue at the moment of the change, because the catalogue is the
 *     only copy of the stock figure that can be trusted — and a quantity above
 *     stock is a checkout the server will refuse.
 *   - **The discount can never exceed the subtotal.** Enforced by an effect
 *     rather than at the point of entry, so it holds however the cart changed —
 *     an item removed after a discount was typed in would otherwise leave a
 *     negative total on screen.
 */
export function usePOSCart({ inventory, vatRate }: UsePOSCartOptions): POSCartController {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [vatRatePercent, setVatRatePercent] = useState(vatRate);
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderVersion, setEditingOrderVersion] = useState<string | null>(null);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [currentItemToDesign, setCurrentItemToDesign] = useState<string | null>(null);

  useEffect(() => {
    const s = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
    setCartDiscount((d) => Math.min(Math.max(0, d), s));
  }, [cart]);

  useEffect(() => {
    setVatRatePercent(vatRate);
  }, [vatRate]);

  const addToCart = useCallback((product: InventoryItem, mode: PosMode) => {
    if (product.stock <= 0) return;

    setCart((previous) => {
      const existing = previous.find((item) => item.id === product.id && !item.isCustom);
      if (existing && mode === 'retail') {
        if (existing.qty >= product.stock) return previous;
        return previous.map((item) =>
          item.id === product.id && !item.isCustom ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [...previous, { ...product, qty: 1, isCustom: mode === 'custom' }];
    });
  }, []);

  const removeFromCart = useCallback((cartIndex: number) => {
    setCart((previous) => previous.filter((_, idx) => idx !== cartIndex));
  }, []);

  const updateQty = useCallback(
    (cartIndex: number, delta: number) => {
      setCart((previous) => {
        const item = previous[cartIndex];
        if (!item) return previous;

        // Stepping down from one removes the line, which is what the cashier
        // expects from the minus button and cheaper than a separate delete.
        if (item.qty === 1 && delta === -1) {
          return previous.filter((_, idx) => idx !== cartIndex);
        }

        return previous.map((current, idx) => {
          if (idx !== cartIndex) return current;
          const product = inventory.find((inv) => inv.id === current.id);
          if (!product) return current;
          return { ...current, qty: Math.max(1, Math.min(current.qty + delta, product.stock)) };
        });
      });
    },
    [inventory],
  );

  const openDesignSelector = useCallback((cartIndex: number) => {
    setCurrentItemToDesign(cartIndex.toString());
    setIsDesignModalOpen(true);
  }, []);

  const selectDesignForItem = useCallback(
    (designId: string) => {
      if (currentItemToDesign === null) return;
      const idx = parseInt(currentItemToDesign);
      setCart((previous) => previous.map((item, i) => (i === idx ? { ...item, designId } : item)));
      setIsDesignModalOpen(false);
      setCurrentItemToDesign(null);
    },
    [currentItemToDesign],
  );

  const closeDesignSelector = useCallback(() => setIsDesignModalOpen(false), []);

  const hydrateFromOrder = useCallback((order: Order, catalogue: InventoryItem[]) => {
    const sourceLineItems: OrderLineItem[] =
      order.lineItems && order.lineItems.length > 0
        ? order.lineItems
        : order.item
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name) => ({
              name,
              quantity: order.quantity,
              designId: order.designId,
            }));

    const hydratedCart: CartItem[] = sourceLineItems
      .map((lineItem): CartItem | null => {
        const inventoryItem =
          (lineItem.itemId ? catalogue.find((item) => item.id === lineItem.itemId) : undefined) ??
          catalogue.find((item) => item.name.toLowerCase() === lineItem.name.toLowerCase());

        if (!inventoryItem) return null;
        return {
          ...inventoryItem,
          qty: lineItem.quantity,
          isCustom: true,
          designId: lineItem.designId,
          notes: order.notes,
        };
      })
      .filter((item): item is CartItem => item !== null);

    setCustomerName(order.customer);
    setCustomerId(order.customerId ?? null);
    setOrderNotes(order.notes || '');
    setCart(hydratedCart);
    setEditingOrderId(order.id);
    setEditingOrderVersion(order.updatedAt);
  }, []);

  const resetForModeSwitch = useCallback(() => {
    setCart([]);
    setEditingOrderId(null);
    setEditingOrderVersion(null);
    setCartDiscount(0);
    setVatRatePercent(vatRate);
    setCustomerId(null);
  }, [vatRate]);

  const resetCart = useCallback(() => {
    setCart([]);
    setCartDiscount(0);
    setVatRatePercent(vatRate);
    setCustomerId(null);
  }, [vatRate]);

  const clearAfterSale = useCallback(() => {
    setCart([]);
    setCustomerName('');
    setCustomerId(null);
    setOrderNotes('');
    setEditingOrderId(null);
    setEditingOrderVersion(null);
  }, []);

  return {
    cart,
    cartDiscount,
    vatRatePercent,
    customerName,
    customerId,
    orderNotes,
    editingOrderId,
    editingOrderVersion,
    isDesignModalOpen,
    setCustomerName,
    setCustomerId,
    setOrderNotes,
    setCartDiscount,
    setVatRatePercent,
    addToCart,
    removeFromCart,
    updateQty,
    openDesignSelector,
    selectDesignForItem,
    closeDesignSelector,
    hydrateFromOrder,
    resetForModeSwitch,
    resetCart,
    clearAfterSale,
  };
}
