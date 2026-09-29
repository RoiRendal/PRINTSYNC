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
  /**
   * Overrides one line's rate.
   *
   * The line's rate IS its `price` — `CartItem` extends `InventoryItem`, and
   * `useCartTotals` already multiplies `price * qty`, so a per-line override
   * needs no new field. It also needs no new plumbing downstream: both checkout
   * paths already send `unitPrice: item.price`, and the sale/order RPCs store
   * that value, so an overridden rate is persisted rather than recomputed.
   */
  setLinePrice: (cartIndex: number, price: number) => void;
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
      return [...previous, { ...product, qty: 1, isCustom: mode === 'custom', cataloguePrice: product.price }];
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

  /**
   * A rate is a money value, so it is clamped the same way every other money
   * input in the cart is: never negative, never NaN. A blank field reads as 0
   * rather than as "leave it alone" — the cashier clearing the box means free,
   * and the alternative is a field that silently keeps a stale number.
   */
  const setLinePrice = useCallback((cartIndex: number, price: number) => {
    setCart((previous) =>
      previous.map((item, idx) => {
        if (idx !== cartIndex) return item;
        const next = Number.isFinite(price) ? Math.max(0, price) : 0;
        return item.price === next ? item : { ...item, price: next };
      }),
    );
  }, []);

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
              // Legacy orders carry no per-line price; the cart re-prices from
              // the catalogue on hydration, so the contract's required field is
              // stated as zero rather than invented.
              unitPrice: 0,
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
          /*
           * Honour the price the order was written with.
           *
           * This used to always re-price from the catalogue, which was harmless
           * while every line was at the catalogue price — but the till can now
           * override a line's rate, and re-pricing on reopen would silently undo
           * the override and change what the order is worth. A stored price of 0
           * still falls back to the catalogue: legacy orders carry no per-line
           * price, and that is the case the fallback exists for.
           */
          price: lineItem.unitPrice > 0 ? lineItem.unitPrice : inventoryItem.price,
          // The catalogue's own figure, so the details surface can still tell an
          // order that was priced by hand from one that was not.
          cataloguePrice: inventoryItem.price,
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
    setLinePrice,
    openDesignSelector,
    selectDesignForItem,
    closeDesignSelector,
    hydrateFromOrder,
    resetForModeSwitch,
    resetCart,
    clearAfterSale,
  };
}
