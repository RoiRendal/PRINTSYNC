import type { User } from '@supabase/supabase-js';

export interface AuthenticatedRequestContext {
  user: User;
  profile: {
    id: string;
    name: string;
    phone: string;
    position: string;
    roleId: string;
  };
  permissions: string[];
}
