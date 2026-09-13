import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AppError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import type { AuthenticatedRequestContext } from '../types/auth.js';

interface CachedAuthContext {
  context: AuthenticatedRequestContext;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const authCache = new Map<string, CachedAuthContext>();

export function invalidateAuthCache(userId: string): void {
  authCache.delete(userId);
}

export async function loadAuthContext(
  supabase: SupabaseClient,
  user: User,
): Promise<AuthenticatedRequestContext> {
  const cached = authCache.get(user.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, phone, position, role_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new AppError(503, 'PROFILE_LOOKUP_FAILED', 'The authenticated profile could not be loaded.');
  }

  if (!profile) {
    throw new AppError(403, 'PROFILE_NOT_PROVISIONED', 'The authenticated user has not been provisioned.');
  }

  const { data: rolePermissions, error: rolePermissionsError } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', profile.role_id);

  if (rolePermissionsError) {
    throw new AppError(503, 'PERMISSIONS_LOOKUP_FAILED', 'The authenticated permissions could not be loaded.');
  }

  const permissionIds = rolePermissions.map((entry) => entry.permission_id);

  let permissions: { key: string }[] = [];
  if (permissionIds.length > 0) {
    const { data: permData, error: permissionsError } = await supabase
      .from('permissions')
      .select('key')
      .in('id', permissionIds);

    if (permissionsError) {
      throw new AppError(503, 'PERMISSIONS_LOOKUP_FAILED', 'The authenticated permissions could not be loaded.');
    }
    permissions = permData;
  }

  const context: AuthenticatedRequestContext = {
    user,
    profile: {
      id: profile.id,
      name: profile.name,
      phone: profile.phone,
      position: profile.position,
      roleId: profile.role_id,
    },
    permissions: permissions.map((permission) => permission.key),
  };

  authCache.set(user.id, {
    context,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  logger.debug({ userId: user.id, permissionCount: context.permissions.length }, 'Auth context loaded and cached');

  return context;
}
