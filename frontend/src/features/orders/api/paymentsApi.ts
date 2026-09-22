import { apiClient, type ApiClient } from '../../../shared/api/client';
import { readApiErrorBody } from '../../../shared/api/errors';
import type {
  Transaction as PaymentTransaction,
  TransactionItem as PaymentTransactionItem,
  CreateTransaction,
  InsufficientStockDetails,
  PaginatedResponse,
} from '@printsync/shared-types';

// The till's transaction row is the shared contract (`Transaction`); it is re-exported
// under the name this module has always used so no caller changes. `CreatePaymentTransaction`
// is that contract plus the one field the POS owns: the idempotency key.
export type { PaymentTransaction, PaymentTransactionItem };

export type CreatePaymentTransaction = CreateTransaction & {
  /**
   * Identifies one checkout attempt. Minted once when the cashier commits to
   * paying, then reused for every retry of that same attempt, so a double-click
   * or a retry after a dropped response cannot charge the customer twice — the
   * server replays the original sale instead of inserting a second one.
   */
  idempotencyKey: string;
};

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
    /**
     * Finds the sale a checkout attempt committed under `key`, if it committed.
     *
     * Resolves to `null` when nothing carries the key, which is an ordinary
     * answer rather than an error — most calls happen after a checkout failed and
     * nothing landed. It throws only when the lookup itself could not be
     * performed, and the caller must treat that as "unknown" rather than "no
     * sale": telling a cashier nothing was written when the till simply could not
     * ask is how a customer gets charged twice.
     */
    findByIdempotencyKey: (key: string) =>
      client.get<PaymentTransaction | null>(`/payments/transactions/by-key/${encodeURIComponent(key)}`),
  };
}

export const paymentsApi = createPaymentsApi();
