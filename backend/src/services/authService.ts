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
    .select('id, name, phone, position, role_id, branch_id, can_view_all_branches, roles(name)')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new AppError(503, 'PROFILE_LOOKUP_FAILED', 'The authenticated profile could not be loaded.');
  }

  if (!profile) {
    throw new AppError(403, 'PROFILE_NOT_PROVISIONED', 'The authenticated user has not been provisioned.');
  }

  /*
   * The role NAME, resolved from the joined row.
   *
   * The context used to carry only `roleId`. The session payload has to report a
   * role the client can act on, and the client's `isAdminTier` compares against
   * the name ('admin' | 'owner'), not a uuid — so the name is loaded here rather
   * than making the client map ids it has no table for.
   *
   * PostgREST returns an embedded to-one relation as an object, but the generated
   * types widen it to an array-or-object union, so both shapes are read. A profile
   * whose role row is missing is not a valid state: it is refused rather than
   * silently defaulted to the narrowest role, because defaulting would hand the
   * account a page list while leaving its permissions intact.
   */
  const embeddedRole = (profile as { roles?: { name?: string } | { name?: string }[] | null }).roles;
  const roleName = Array.isArray(embeddedRole) ? embeddedRole[0]?.name : embeddedRole?.name;
  if (roleName !== 'admin' && roleName !== 'staff' && roleName !== 'owner') {
    throw new AppError(503, 'INVALID_ROLE_CONFIGURATION', 'A user has an invalid role configuration.');
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
      role: roleName,
      branchId: profile.branch_id ? String(profile.branch_id) : null,
      // Coerced rather than trusted: PostgREST hands back a real boolean for a
      // `boolean not null default false` column, but this value decides whether an
      // account may read another branch's figures, so a missing column or a null
      // must fail closed rather than be truthy by accident.
      canViewAllBranches: profile.can_view_all_branches === true,
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
