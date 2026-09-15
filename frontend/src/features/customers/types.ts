export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateCustomer = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCustomer = Partial<CreateCustomer>;
