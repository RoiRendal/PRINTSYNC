import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { MOCK_DESIGNS } from '../data/mockDesigns';
import type { CreateDesign, Design, UpdateDesign } from '../types';

interface DesignContextValue {
  designs: Design[];
  addDesign: (design: CreateDesign) => void;
  updateDesign: (id: string, design: UpdateDesign) => void;
  deleteDesign: (id: string) => void;
}

const DesignContext = createContext<DesignContextValue | undefined>(undefined);

export function DesignProvider({ children }: { children: ReactNode }) {
  const [designs, setDesigns] = useState<Design[]>(MOCK_DESIGNS);

  const addDesign = (newDesign: CreateDesign) => {
    const design: Design = {
      ...newDesign,
      id: `DSG-${String(designs.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setDesigns((previousDesigns) => [...previousDesigns, design]);
  };

  const updateDesign = (id: string, updatedDesign: UpdateDesign) => {
    setDesigns((previousDesigns) => previousDesigns.map((design) => (
      design.id === id ? { ...design, ...updatedDesign } : design
    )));
  };

  const deleteDesign = (id: string) => {
    setDesigns((previousDesigns) => previousDesigns.filter((design) => design.id !== id));
  };

  return (
    <DesignContext.Provider value={{ designs, addDesign, updateDesign, deleteDesign }}>
      {children}
    </DesignContext.Provider>
  );
}

export function useDesigns() {
  const context = useContext(DesignContext);
  if (context === undefined) {
    throw new Error('useDesigns must be used within a DesignProvider');
  }
  return context;
}
