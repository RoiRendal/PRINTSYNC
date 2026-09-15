import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { PaginatedResponse } from '@printsync/shared-types';
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
}

export function createPaymentsApi(client: ApiClient = apiClient) {
  return {
    list: (query?: { page?: number; limit?: number }) => client.get<PaginatedResponse<PaymentTransaction>>('/payments/transactions', query),
    create: (payload: CreatePaymentTransaction) => client.post<PaymentTransaction, CreatePaymentTransaction>('/payments/transactions', payload),
    void: (id: string) => client.post<PaymentTransaction, Record<string, never>>(`/payments/transactions/${id}/void`, {}),
  };
}

export const paymentsApi = createPaymentsApi();