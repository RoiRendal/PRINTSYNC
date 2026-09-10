import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { designsApi } from '../api/designsApi';
import { ApiError } from '../../../shared/api/errors';
import type { CreateDesign, Design, UpdateDesign } from '../types';

interface DesignContextValue {
  designs: Design[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  addDesign: (design: CreateDesign) => Promise<void>;
  updateDesign: (id: string, design: UpdateDesign) => Promise<void>;
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
    try {
      const design = await designsApi.create(newDesign);
      setDesigns((previousDesigns) => [design, ...previousDesigns]);
      setError(null);
    } catch (requestError: unknown) {
      setError(requestError instanceof ApiError ? requestError.message : 'Design could not be created.');
    }
  };

  const updateDesign = async (id: string, updatedDesign: UpdateDesign) => {
    const existingDesign = designs.find((design) => design.id === id);
    if (!existingDesign) return;
    try {
      const design = await designsApi.update(id, {
        name: updatedDesign.name ?? existingDesign.name,
        category: updatedDesign.category ?? existingDesign.category,
        imageUrl: updatedDesign.imageUrl ?? existingDesign.imageUrl,
        tags: updatedDesign.tags ?? existingDesign.tags,
        assetType: updatedDesign.assetType ?? existingDesign.assetType,
        assetSizeBytes: updatedDesign.assetSizeBytes ?? existingDesign.assetSizeBytes,
      });
      setDesigns((previousDesigns) => previousDesigns.map((current) => current.id === id ? design : current));
      setError(null);
    } catch (requestError: unknown) {
      setError(requestError instanceof ApiError ? requestError.message : 'Design could not be updated.');
    }
  };

  const deleteDesign = async (id: string) => {
    try {
      await designsApi.remove(id);
      setDesigns((previousDesigns) => previousDesigns.filter((design) => design.id !== id));
      setError(null);
    } catch (requestError: unknown) {
      setError(requestError instanceof ApiError ? requestError.message : 'Design could not be deleted.');
    }
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
