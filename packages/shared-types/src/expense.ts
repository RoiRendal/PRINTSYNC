export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  createdBy: string | undefined;
  createdAt: string;
}

export type CreateExpense = Omit<Expense, 'id' | 'createdBy' | 'createdAt'>;

export type UpdateExpense = Partial<CreateExpense>;
