import { apiClient, type ApiClient } from '../../../shared/api/client';
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
    list: () => client.get<PaymentTransaction[]>('/payments/transactions'),
    create: (payload: CreatePaymentTransaction) => client.post<PaymentTransaction, CreatePaymentTransaction>('/payments/transactions', payload),
    void: (id: string) => client.post<PaymentTransaction, Record<string, never>>(`/payments/transactions/${id}/void`, {}),
  };
}

export const paymentsApi = createPaymentsApi();