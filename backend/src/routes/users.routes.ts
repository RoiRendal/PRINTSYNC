import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { AppError } from '../shared/errors.js';
import { createUser, deleteUser, getUserBranch, listUsers, updateUser } from '../modules/users/users.service.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { publishDataChange } from '../services/domainEventBus.js';
import { parsePaginationQuery } from '../shared/pagination.js';

export const usersRouter = Router();

const userSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().default(''),
  // 'owner' is the head-office role the owner asked for. It is assignable, not a
  // hidden flag: choosing it is what sets `can_view_all_branches`, so the
  // cross-branch exception is granted by a deliberate role change rather than by a
  // boolean anyone could flip.
  role: z.enum(['admin', 'staff', 'owner']),
  position: z.string().trim().default(''),
  // Required: every account belongs to exactly one branch (the owner's rule).
  // There is no sensible default — silently filing a new hire under Balayan is how
  // a Nasugbu staff member ends up seeing the wrong stock.
  branchId: z.string().uuid(),
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
  // The affected user's branch, not the caller's. User administration is
  // performed from head office, but the account that changed belongs to a branch
  // — and that is the branch whose staff screens show the directory. Publishing
  // the *caller's* branch would tell the wrong shop to refetch, and tell the
  // right one nothing.
  publishDataChange(createdUser.branchId, 'users');
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
  publishDataChange(updatedUser.branchId, 'users');
  response.json({ data: updatedUser });
});

usersRouter.delete('/:id', authenticate, requirePermission('users.manage'), async (request, response) => {
  const userId = getUserId(request);
  if (request.auth?.profile.id === userId) {
    throw new AppError(400, 'SELF_DELETE_NOT_ALLOWED', 'You cannot delete your own user account.');
  }
  /*
   * The branch is read **before** the delete, because after it there is nothing
   * left to ask. The deletion is audited, and the audit row is the only remaining
   * evidence of which shop the account belonged to — the same ordering reason the
   * order-delete RPC captures its context before removing the row.
   */
  const targetBranchId = await getUserBranch(getSupabase(), userId);
  await deleteUser(getSupabase(), userId);
  await writeAuditLog(getSupabase(), {
    actorId: request.auth?.user.id,
    action: 'user.deleted',
    entityType: 'user',
    entityId: userId,
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  });
  publishDataChange(targetBranchId, 'users');
  response.status(204).send();
});
