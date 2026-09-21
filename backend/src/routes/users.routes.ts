import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { AppError } from '../shared/errors.js';
import { createUser, deleteUser, listUsers, updateUser } from '../modules/users/users.service.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { publishDataChange } from '../services/domainEventBus.js';
import { parsePaginationQuery } from '../shared/pagination.js';

export const usersRouter = Router();

const userSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().default(''),
  role: z.enum(['admin', 'staff']),
  position: z.string().trim().default(''),
  createdAt: z.string().trim().optional(),
  password: z.string().min(8).optional(),
});

function getSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AppError(503, 'SUPABASE_NOT_CONFIGURED', 'Supabase has not been configured for this environment.');
  }
  return supabase;
}

/**
 * Narrows `:id` to a string, mirroring `getOrderId` in `orders.routes.ts`.
 *
 * Two reasons this exists rather than reading `request.params.id` inline. Express
 * types a parameter as `string | string[] | undefined` once a route carries inline
 * middleware — the router-wide `usersRouter.use(...)` this replaced hid that, and
 * the loose type only surfaced when the guard moved onto the routes. And a param
 * that can be an array should never reach a query unchecked.
 */
function getUserId(request: { params: Record<string, string | string[] | undefined> }): string {
  const id = request.params.id;
  if (!id || Array.isArray(id)) throw new AppError(400, 'INVALID_USER_ID', 'The user id is invalid.');
  return id;
}

/**
 * The directory is gated on `users.read`; changing a user still needs
 * `users.manage`.
 *
 * A single `usersRouter.use(authenticate, requirePermission('users.manage'))`
 * used to guard every route in this file, which made `users.read` dead in the API
 * layer — it was seeded, and used by the realtime domain filter and the page map,
 * but nothing here ever checked it. Reading the staff directory and editing it are
 * different powers, and only one of them should be needed to look at a name and
 * phone number.
 *
 * No visibility changes today: both keys are granted to `admin` alone, so staff
 * still cannot reach either. The difference appears the moment a read-only role is
 * introduced — which is exactly what `users.read` already exists for.
 */
usersRouter.get('/', authenticate, requirePermission('users.read'), async (request, response) => {
  response.json({ data: await listUsers(getSupabase(), parsePaginationQuery(request.query)) });
});

usersRouter.post('/', authenticate, requirePermission('users.manage'), async (request, response) => {
  const parsed = userSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_USER_REQUEST', 'The user details are invalid.');
  const createdUser = await createUser(getSupabase(), parsed.data);
  await writeAuditLog(getSupabase(), {
    actorId: request.auth?.user.id,
    action: 'user.created',
    entityType: 'user',
    entityId: createdUser.id,
    metadata: { role: createdUser.role },
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  });
  publishDataChange('users');
  response.status(201).json({ data: createdUser });
});

usersRouter.patch('/:id', authenticate, requirePermission('users.manage'), async (request, response) => {
  const parsed = userSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_USER_REQUEST', 'The user details are invalid.');
  const updatedUser = await updateUser(getSupabase(), getUserId(request), parsed.data);
  await writeAuditLog(getSupabase(), {
    actorId: request.auth?.user.id,
    action: 'user.updated',
    entityType: 'user',
    entityId: updatedUser.id,
    metadata: { role: updatedUser.role },
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  });
  publishDataChange('users');
  response.json({ data: updatedUser });
});

usersRouter.delete('/:id', authenticate, requirePermission('users.manage'), async (request, response) => {
  const userId = getUserId(request);
  if (request.auth?.profile.id === userId) {
    throw new AppError(400, 'SELF_DELETE_NOT_ALLOWED', 'You cannot delete your own user account.');
  }
  await deleteUser(getSupabase(), userId);
  await writeAuditLog(getSupabase(), {
    actorId: request.auth?.user.id,
    action: 'user.deleted',
    entityType: 'user',
    entityId: userId,
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  });
  publishDataChange('users');
  response.status(204).send();
});
