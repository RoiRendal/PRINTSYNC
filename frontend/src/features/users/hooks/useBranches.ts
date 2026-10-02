import { useEffect, useState } from 'react';
import type { Branch } from '@printsync/shared-types';
import { branchesApi } from '../api/branchesApi';
import { describeApiError } from '../../../shared/api/errors';

/**
 * The branch list, loaded once per mount.
 *
 * Branches change approximately never — a shop is opened, not created on a
 * Tuesday — so this is a plain fetch with no polling and no store. If a third
 * branch is ever added, staff pick it up on their next page load.
 */
export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await branchesApi.list();
        if (!cancelled) setBranches(result);
      } catch (loadError) {
        if (!cancelled) setError(describeApiError(loadError, 'The branches could not be loaded.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { branches, isLoading, error };
}
