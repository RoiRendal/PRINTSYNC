import type { User } from '@supabase/supabase-js';

export interface AuthenticatedRequestContext {
  user: User;
  profile: {
    id: string;
    name: string;
    phone: string;
    position: string;
    roleId: string;
    /**
     * The branch this account belongs to.
     *
     * `null` only in the window between the auth row existing and its profile
     * row being written — `loadAuthContext` rejects such a request with 403
     * `PROFILE_NOT_PROVISIONED` before it reaches a handler, so a handler can
     * treat a non-null value as guaranteed. (Phase 2 makes the column NOT NULL.)
     */
    branchId: string | null;
    /**
     * Head office / owner only. The single exception to branch separation, and it
     * is **read-only and analytics-only** by design: it gates a branch selector on
     * reporting, never a cross-branch write. Phase 3 enforces that split.
     */
    canViewAllBranches: boolean;
  };
  permissions: string[];
}
