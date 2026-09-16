import { apiClient, type ApiClient } from '../../../shared/api/client';
import { readApiErrorBody } from '../../../shared/api/errors';
import type { InsufficientStockDetails, PaginatedResponse } from '@printsync/shared-types';
import type { PaymentMethod } from '../types';

export interface PaymentTransactionItem {
  itemId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface PaymentTransaction {
  id: string;
  status: 'completed' | 'voided';
  items: PaymentTransactionItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentAmount: number;
  date: string;
}

export interface CreatePaymentTransaction {
  items: PaymentTransactionItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentAmount: number;
  /**
   * Identifies one checkout attempt. Minted once when the cashier commits to
   * paying, then reused for every retry of that same attempt, so a double-click
   * or a retry after a dropped response cannot charge the customer twice — the
   * server replays the original sale instead of inserting a second one.
   */
  idempotencyKey: string;
}

/**
 * Reads the structured stock shortfall off a failed checkout.
 *
 * The API answers a short-stock rejection with `409 INSUFFICIENT_STOCK` and the
 * offending item's numbers, so the POS can flag the exact cart line instead of
 * showing a bare banner. Returns `null` for every other failure, letting the
 * caller fall back to the generic message rather than mistaking an unrelated
 * error for a stock problem.
 */
export function readInsufficientStock(error: unknown): InsufficientStockDetails | null {
  const body = readApiErrorBody(error);
  if (!body || body.code !== 'INSUFFICIENT_STOCK') return null;

  const details = body.details;
  if (!details || typeof details !== 'object') return null;

  const candidate = details as Record<string, unknown>;
  if (
    typeof candidate.itemId !== 'string' ||
    typeof candidate.itemName !== 'string' ||
    typeof candidate.available !== 'number' ||
    typeof candidate.requested !== 'number'
  ) {
    return null;
  }

  return {
    itemId: candidate.itemId,
    itemName: candidate.itemName,
    available: candidate.available,
    requested: candidate.requested,
  };
}

export function createPaymentsApi(client: ApiClient = apiClient) {
  return {
    list: (query?: { page?: number; limit?: number }) => client.get<PaginatedResponse<PaymentTransaction>>('/payments/transactions', query),
    create: (payload: CreatePaymentTransaction) => client.post<PaymentTransaction, CreatePaymentTransaction>('/payments/transactions', payload),
    void: (id: string) => client.post<PaymentTransaction, Record<string, never>>(`/payments/transactions/${id}/void`, {}),
  };
}

export const paymentsApi = createPaymentsApi();
