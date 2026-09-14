import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { designsApi } from '../api/designsApi';
import { ApiError } from '../../../shared/api/errors';
import type { CreateDesign, Design, UpdateDesign } from '../types';

interface DesignContextValue {
  designs: Design[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  addDesign: (design: CreateDesign) => Promise<Design>;
  updateDesign: (id: string, design: UpdateDesign) => Promise<Design>;
  deleteDesign: (id: string) => Promise<void>;
}

const DesignContext = createContext<DesignContextValue | undefined>(undefined);

export function DesignProvider({ children }: { children: ReactNode }) {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    void designsApi.list()
      .then((loadedDesigns) => {
        if (mounted) {
          setDesigns(loadedDesigns);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (mounted) setError(requestError instanceof ApiError ? requestError.message : 'Designs could not be loaded.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, [refreshKey]);

  const addDesign = async (newDesign: CreateDesign) => {
    const design = await designsApi.create(newDesign);
    setDesigns((previousDesigns) => [design, ...previousDesigns]);
    return design;
  };

  const updateDesign = async (id: string, updatedDesign: UpdateDesign) => {
    const existingDesign = designs.find((design) => design.id === id);
    if (!existingDesign) throw new Error('Design not found.');
    const design = await designsApi.update(id, {
      name: updatedDesign.name ?? existingDesign.name,
      category: updatedDesign.category ?? existingDesign.category,
      imageUrl: updatedDesign.imageUrl ?? existingDesign.imageUrl,
      tags: updatedDesign.tags ?? existingDesign.tags,
      assetType: updatedDesign.assetType ?? existingDesign.assetType,
      assetSizeBytes: updatedDesign.assetSizeBytes ?? existingDesign.assetSizeBytes,
    });
    setDesigns((previousDesigns) => previousDesigns.map((current) => current.id === id ? design : current));
    return design;
  };

  const deleteDesign = async (id: string) => {
    await designsApi.remove(id);
    setDesigns((previousDesigns) => previousDesigns.filter((design) => design.id !== id));
  };

  return (
    <DesignContext.Provider value={{ designs, isLoading, error, refresh: () => setRefreshKey((value) => value + 1), addDesign, updateDesign, deleteDesign }}>
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
