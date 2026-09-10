import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { designsApi } from '../api/designsApi';
import type { CreateDesign, Design, UpdateDesign } from '../types';

interface DesignContextValue {
  designs: Design[];
  addDesign: (design: CreateDesign) => void;
  updateDesign: (id: string, design: UpdateDesign) => void;
  deleteDesign: (id: string) => void;
}

const DesignContext = createContext<DesignContextValue | undefined>(undefined);

export function DesignProvider({ children }: { children: ReactNode }) {
  const [designs, setDesigns] = useState<Design[]>([]);

  useEffect(() => {
    let mounted = true;
    void designsApi.list().then((loadedDesigns) => {
      if (mounted) setDesigns(loadedDesigns);
    });
    return () => { mounted = false; };
  }, []);

  const addDesign = (newDesign: CreateDesign) => {
    void designsApi.create(newDesign).then((design) => {
      setDesigns((previousDesigns) => [design, ...previousDesigns]);
    });
  };

  const updateDesign = (id: string, updatedDesign: UpdateDesign) => {
    const existingDesign = designs.find((design) => design.id === id);
    if (!existingDesign) return;
    void designsApi.update(id, {
      name: updatedDesign.name ?? existingDesign.name,
      category: updatedDesign.category ?? existingDesign.category,
      imageUrl: updatedDesign.imageUrl ?? existingDesign.imageUrl,
      tags: updatedDesign.tags ?? existingDesign.tags,
      assetType: updatedDesign.assetType ?? existingDesign.assetType,
      assetSizeBytes: updatedDesign.assetSizeBytes ?? existingDesign.assetSizeBytes,
    }).then((design) => {
      setDesigns((previousDesigns) => previousDesigns.map((current) => current.id === id ? design : current));
    });
  };

  const deleteDesign = (id: string) => {
    void designsApi.remove(id).then(() => {
      setDesigns((previousDesigns) => previousDesigns.filter((design) => design.id !== id));
    });
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
