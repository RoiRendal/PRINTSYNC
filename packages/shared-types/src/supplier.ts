export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateSupplier = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateSupplier = Partial<CreateSupplier>;
