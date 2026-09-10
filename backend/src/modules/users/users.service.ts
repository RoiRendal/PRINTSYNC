import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../shared/errors.js';

export type UserRole = 'admin' | 'staff';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  position: string;
  createdAt: string;
  access: string[];
}

interface UserInput {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  position: string;
  createdAt?: string | undefined;
  password?: string | undefined;
}

const permissionToPage: Record<string, string> = {
  'dashboard.read': 'dashboard',
  'orders.read': 'orders',
  'inventory.read': 'inventory',
  'pos.read': 'pos',
  'analytics.read': 'analytics',
  'users.read': 'users',
  'settings.manage': 'settings',
};

async function getRole(supabase: SupabaseClient, role: UserRole) {
  const { data, error } = await supabase
    .from('roles')
    .select('id, name')
    .eq('name', role)
    .single();

  if (error || !data) {
    throw new AppError(400, 'INVALID_ROLE', 'The requested role is not configured.');
  }
  return data;
}

async function getRoleAccess(supabase: SupabaseClient, roleId: string): Promise<string[]> {
  const { data: rolePermissions, error: rolePermissionsError } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', roleId);

  if (rolePermissionsError) {
    throw new AppError(503, 'PERMISSIONS_LOOKUP_FAILED', 'User permissions could not be loaded.');
  }

  const permissionIds = rolePermissions.map((entry) => entry.permission_id);
  if (permissionIds.length === 0) return [];

  const { data: permissions, error: permissionsError } = await supabase
    .from('permissions')
    .select('key')
    .in('id', permissionIds);

  if (permissionsError) {
    throw new AppError(503, 'PERMISSIONS_LOOKUP_FAILED', 'User permissions could not be loaded.');
  }

  return permissions
    .map((permission) => permissionToPage[permission.key])
    .filter((page): page is string => page !== undefined);
}

async function toSummary(
  supabase: SupabaseClient,
  profile: { id: string; name: string; phone: string; position: string; role_id: string; created_at: string },
  email: string,
  role: UserRole,
): Promise<UserSummary> {
  return {
    id: profile.id,
    name: profile.name,
    email,
    phone: profile.phone,
    role,
    position: profile.position,
    createdAt: profile.created_at.slice(0, 10),
    access: await getRoleAccess(supabase, profile.role_id),
  };
}

export async function listUsers(supabase: SupabaseClient): Promise<UserSummary[]> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, phone, position, role_id, created_at, roles(name)')
    .order('created_at', { ascending: true });

  if (error) throw new AppError(503, 'USERS_LOOKUP_FAILED', 'Users could not be loaded.');

  const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authUsersError) throw new AppError(503, 'USERS_LOOKUP_FAILED', 'Users could not be loaded.');

  const emails = new Map(authUsers.users.map((user) => [user.id, user.email ?? '']));
  return Promise.all(profiles.map((profile) => {
    const role = (profile.roles as unknown as { name: UserRole } | null)?.name;
    if (role !== 'admin' && role !== 'staff') {
      throw new AppError(503, 'INVALID_ROLE_CONFIGURATION', 'A user has an invalid role configuration.');
    }
    return toSummary(supabase, profile, emails.get(profile.id) ?? '', role);
  }));
}

export async function createUser(supabase: SupabaseClient, input: UserInput): Promise<UserSummary> {
  if (!input.password) {
    throw new AppError(400, 'PASSWORD_REQUIRED', 'A password is required when creating a user.');
  }

  const role = await getRole(supabase, input.role);
  const { data: createdAuth, error: authError } = await supabase.auth.admin.createUser({
    email: input.email.toLowerCase(),
    password: input.password,
    email_confirm: true,
  });

  if (authError || !createdAuth.user) {
    throw new AppError(400, 'USER_CREATION_FAILED', 'The user could not be created.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: createdAuth.user.id,
      name: input.name.trim(),
      phone: input.phone.trim(),
      position: input.position.trim(),
      role_id: role.id,
      ...(input.createdAt ? { created_at: input.createdAt } : {}),
    })
    .select('id, name, phone, position, role_id, created_at')
    .single();

  if (profileError || !profile) {
    await supabase.auth.admin.deleteUser(createdAuth.user.id);
    throw new AppError(400, 'PROFILE_CREATION_FAILED', 'The user profile could not be created.');
  }

  return toSummary(supabase, profile, createdAuth.user.email ?? input.email, input.role);
}

export async function updateUser(supabase: SupabaseClient, id: string, input: UserInput): Promise<UserSummary> {
  const role = await getRole(supabase, input.role);
  const { error: authError } = await supabase.auth.admin.updateUserById(id, {
    email: input.email.toLowerCase(),
    ...(input.password ? { password: input.password } : {}),
  });
  if (authError) throw new AppError(400, 'USER_UPDATE_FAILED', 'The user could not be updated.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update({
      name: input.name.trim(),
      phone: input.phone.trim(),
      position: input.position.trim(),
      role_id: role.id,
      ...(input.createdAt ? { created_at: input.createdAt } : {}),
    })
    .eq('id', id)
    .select('id, name, phone, position, role_id, created_at')
    .single();

  if (profileError || !profile) throw new AppError(404, 'USER_NOT_FOUND', 'The user profile was not found.');
  return toSummary(supabase, profile, input.email, input.role);
}

export async function deleteUser(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw new AppError(404, 'USER_NOT_FOUND', 'The user was not found.');
}
