import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { designsApi } from '../api/designsApi';
import { ApiError } from '../../../shared/api/errors';
import type { CreateDesign, Design, UpdateDesign } from '../types';

interface DesignContextValue {
  designs: Design[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  goToPage: (page: number) => void;
  addDesign: (design: CreateDesign) => Promise<Design>;
  updateDesign: (id: string, design: UpdateDesign) => Promise<Design>;
  deleteDesign: (id: string) => Promise<void>;
}

const DesignContext = createContext<DesignContextValue | undefined>(undefined);

export function DesignProvider({ children }: { children: ReactNode }) {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    void designsApi.list({ page, limit })
      .then((response) => {
        if (mounted) {
          setDesigns(response.data);
          setTotal(response.total);
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
  }, [refreshKey, page, limit]);

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

  const goToPage = (nextPage: number) => setPage(Math.max(1, nextPage));
  const refresh = () => setRefreshKey((value) => value + 1);

  return (
    <DesignContext.Provider value={{ designs, total, page, limit, isLoading, error, refresh, goToPage, addDesign, updateDesign, deleteDesign }}>
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
