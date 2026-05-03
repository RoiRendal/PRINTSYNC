import React, { createContext, useContext, useState, ReactNode } from 'react';
import { InventoryItem, Design } from '../types';
import { MOCK_INVENTORY, MOCK_DESIGNS } from '../constants';

interface InventoryContextType {
  items: InventoryItem[];
  designs: Design[];
  addItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateItem: (id: string, item: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  addDesign: (design: Omit<Design, 'id' | 'createdAt'>) => void;
  deleteDesign: (id: string) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [designs, setDesigns] = useState<Design[]>(MOCK_DESIGNS);

  const addItem = (newItem: Omit<InventoryItem, 'id'>) => {
    const item: InventoryItem = {
      ...newItem,
      id: `INV-${String(items.length + 1).padStart(3, '0')}`,
    };
    setItems(prev => [...prev, item]);
  };

  const updateItem = (id: string, updatedItem: Partial<InventoryItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updatedItem } : item));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const addDesign = (newDesign: Omit<Design, 'id' | 'createdAt'>) => {
    const design: Design = {
      ...newDesign,
      id: `DSG-${String(designs.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setDesigns(prev => [...prev, design]);
  };

  const deleteDesign = (id: string) => {
    setDesigns(prev => prev.filter(d => d.id !== id));
  };

  return (
    <InventoryContext.Provider value={{ items, designs, addItem, updateItem, deleteItem, addDesign, deleteDesign }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
