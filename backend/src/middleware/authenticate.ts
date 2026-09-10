import type { RequestHandler } from 'express';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { AppError } from '../shared/errors.js';

function getBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  return token || null;
}

export const authenticate: RequestHandler = async (request, _response, next) => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    next(new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.'));
    return;
  }

  const token = getBearerToken(request.header('authorization'));
  if (!token) {
    next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'A valid bearer token is required.'));
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    next(new AppError(401, 'INVALID_AUTHENTICATION', 'The supplied bearer token is invalid or expired.'));
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, phone, position, role_id')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    next(new AppError(503, 'PROFILE_LOOKUP_FAILED', 'The authenticated profile could not be loaded.'));
    return;
  }

  if (!profile) {
    next(new AppError(403, 'PROFILE_NOT_PROVISIONED', 'The authenticated user has not been provisioned.'));
    return;
  }

  const { data: rolePermissions, error: rolePermissionsError } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', profile.role_id);

  if (rolePermissionsError) {
    next(new AppError(503, 'PERMISSIONS_LOOKUP_FAILED', 'The authenticated permissions could not be loaded.'));
    return;
  }

  const permissionIds = rolePermissions.map((entry) => entry.permission_id);
  if (permissionIds.length === 0) {
    request.auth = {
      user: data.user,
      profile: {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        position: profile.position,
        roleId: profile.role_id,
      },
      permissions: [],
    };
    next();
    return;
  }

  const { data: permissions, error: permissionsError } = await supabase
    .from('permissions')
    .select('key')
    .in('id', permissionIds);

  if (permissionsError) {
    next(new AppError(503, 'PERMISSIONS_LOOKUP_FAILED', 'The authenticated permissions could not be loaded.'));
    return;
  }

  request.auth = {
    user: data.user,
    profile: {
      id: profile.id,
      name: profile.name,
      phone: profile.phone,
      position: profile.position,
      roleId: profile.role_id,
    },
    permissions: permissions.map((permission) => permission.key),
  };
  next();
};
