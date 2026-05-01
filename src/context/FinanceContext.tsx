import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { FinancialRecord, FinancialStats } from '../types';
import { MOCK_FINANCIAL_RECORDS } from '../constants';

interface FinanceContextType {
  records: FinancialRecord[];
  stats: FinancialStats;
  addRecord: (record: Omit<FinancialRecord, 'id'>) => void;
  deleteRecord: (id: string) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [records, setRecords] = useState<FinancialRecord[]>(MOCK_FINANCIAL_RECORDS as FinancialRecord[]);

  const stats = useMemo<FinancialStats>(() => {
    const totalRevenue = records
      .filter(r => r.type === 'Income')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpenses = records
      .filter(r => r.type === 'Expense')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalExpenses, netProfit, profitMargin };
  }, [records]);

  const addRecord = (record: Omit<FinancialRecord, 'id'>) => {
    const newRecord: FinancialRecord = {
      ...record,
      id: `FIN-${Date.now()}`,
    };
    setRecords(prev => [newRecord, ...prev]);
  };

  const deleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  return (
    <FinanceContext.Provider value={{ records, stats, addRecord, deleteRecord }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
