import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaginationParams, PaginatedResponse } from '@printsync/shared-types';
import { AppError } from '../../shared/errors.js';
import { calculateRange, createPaginatedResponse } from '../../shared/pagination.js';

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

/**
 * The slice of a Supabase `AuthError` this service reasons about.
 *
 * Read defensively instead of importing the provider's type: the error arrives
 * through a promise rejection, so nothing guarantees its shape at runtime, and
 * a wrong assumption here would replace a useful message with a crash.
 */
interface AuthFailure {
  code: string | undefined;
  status: number | undefined;
  message: string | undefined;
}

function asAuthFailure(error: unknown): AuthFailure | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as Record<string, unknown>;
  return {
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    status: typeof candidate.status === 'number' ? candidate.status : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
  };
}

/**
 * Supabase answers a duplicate email with `code: 'email_exists'`. The message
 * text is checked as well, because that code has not been present across every
 * provider version — and this is the single most likely way adding a staff
 * member fails: a manager re-adding somebody who already has an account.
 */
function isDuplicateEmail(failure: AuthFailure): boolean {
  if (failure.code === 'email_exists') return true;
  return /already\s+(been\s+)?registered|already\s+exists/i.test(failure.message ?? '');
}

/**
 * Turns a provider failure into something worth putting on screen.
 *
 * The distinction that matters: a 4xx is the provider judging the *request*, so
 * the message can be definite. A 5xx — or an error carrying no status at all —
 * is an outage, and reporting an outage as a bad request sends the manager
 * hunting for a typo that is not there.
 */
function authFailureToAppError(error: unknown, context: 'create' | 'update'): AppError {
  const failure = asAuthFailure(error);
  const fallbackCode = context === 'create' ? 'USER_CREATION_FAILED' : 'USER_UPDATE_FAILED';
  const fallbackVerb = context === 'create' ? 'created' : 'updated';

  if (failure && isDuplicateEmail(failure)) {
    return new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'A user with this email address already exists.');
  }

  if (!failure || failure.status === undefined || failure.status >= 500) {
    return new AppError(
      503,
      'AUTH_SERVICE_UNAVAILABLE',
      `The user could not be ${fallbackVerb} because the authentication service is unavailable. Try again in a moment.`,
    );
  }

  /*
   * A 4xx from the provider. Its own wording is the most truthful thing
   * available here — "Password should be at least 6 characters" tells the
   * manager something a generic sentence cannot — so prefer it.
   */
  return new AppError(
    400,
    fallbackCode,
    failure.message?.trim() || 'The user details were rejected by the authentication service.',
  );
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

export async function listUsers(
  supabase: SupabaseClient,
  params: PaginationParams,
): Promise<PaginatedResponse<UserSummary>> {
  const { start, end } = calculateRange(params.page, params.limit);
  const { data: profiles, error, count } = await supabase
    .from('profiles')
    .select('id, name, phone, position, role_id, created_at, roles(name)', { count: 'exact' })
    .order('created_at', { ascending: true })
    .range(start, end);

  if (error) throw new AppError(503, 'USERS_LOOKUP_FAILED', 'Users could not be loaded.');

  const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authUsersError) throw new AppError(503, 'USERS_LOOKUP_FAILED', 'Users could not be loaded.');

  const emails = new Map(authUsers.users.map((user) => [user.id, user.email ?? '']));
  const items = await Promise.all(profiles.map((profile) => {
    const role = (profile.roles as unknown as { name: UserRole } | null)?.name;
    if (role !== 'admin' && role !== 'staff') {
      throw new AppError(503, 'INVALID_ROLE_CONFIGURATION', 'A user has an invalid role configuration.');
    }
    return toSummary(supabase, profile, emails.get(profile.id) ?? '', role);
  }));
  return createPaginatedResponse(items, count ?? 0, params.page, params.limit);
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

  /*
   * Previously every possible cause collapsed into one sentence — "The user
   * could not be created" — so a duplicate email, a rejected password and a
   * provider outage were indistinguishable on screen.
   */
  if (authError || !createdAuth.user) {
    throw authFailureToAppError(authError, 'create');
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
  if (authError) throw authFailureToAppError(authError, 'update');

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
  if (!error) return;

  const failure = asAuthFailure(error);
  /*
   * A missing user is a verdict about the request. Anything else is the
   * provider failing us, and reporting an outage as "the user was not found"
   * sends staff hunting for somebody who is right there on the screen.
   */
  if (failure?.status === 404) {
    throw new AppError(404, 'USER_NOT_FOUND', 'The user was not found.');
  }
  throw new AppError(
    503,
    'USER_DELETE_FAILED',
    'The user could not be deleted because the authentication service is unavailable. Try again in a moment.',
  );
}
