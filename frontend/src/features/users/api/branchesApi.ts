import { apiClient, type ApiClient } from '../../../shared/api/client';
import type { Branch } from '@printsync/shared-types';

export function createBranchesApi(client: ApiClient = apiClient) {
  return {
    /**
     * The shops this business runs.
     *
     * Not branch-scoped: the user form needs every branch to populate its picker,
     * and the head-office selector needs the branch it is *not* currently in. The
     * branch list is public information — it is printed on every receipt — whereas
     * the data behind each branch is scoped separately.
     */
    list: async () => await client.get<Branch[]>('/branches'),
  };
}

export const branchesApi = createBranchesApi();
