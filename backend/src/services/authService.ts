import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AppError } from '../shared/errors.js';
import type { AuthenticatedRequestContext } from '../types/auth.js';

export async function loadAuthContext(
  supabase: SupabaseClient,
  user: User,
): Promise<AuthenticatedRequestContext> {
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
  if (permissionIds.length === 0) {
    return {
      user,
      profile: {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        position: profile.position,
        roleId: profile.role_id,
      },
      permissions: [],
    };
  }

  const { data: permissions, error: permissionsError } = await supabase
    .from('permissions')
    .select('key')
    .in('id', permissionIds);

  if (permissionsError) {
    throw new AppError(503, 'PERMISSIONS_LOOKUP_FAILED', 'The authenticated permissions could not be loaded.');
  }

  return {
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
}
