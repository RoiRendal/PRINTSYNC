import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { AppError } from '../shared/errors.js';
import { createUser, deleteUser, listUsers, updateUser } from '../modules/users/users.service.js';
import { writeAuditLog } from '../services/auditLogService.js';
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

usersRouter.use(authenticate, requirePermission('users.manage'));

usersRouter.get('/', async (request, response) => {
  response.json({ data: await listUsers(getSupabase(), parsePaginationQuery(request.query)) });
});

usersRouter.post('/', async (request, response) => {
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
  response.status(201).json({ data: createdUser });
});

usersRouter.patch('/:id', async (request, response) => {
  const parsed = userSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_USER_REQUEST', 'The user details are invalid.');
  const updatedUser = await updateUser(getSupabase(), request.params.id, parsed.data);
  await writeAuditLog(getSupabase(), {
    actorId: request.auth?.user.id,
    action: 'user.updated',
    entityType: 'user',
    entityId: updatedUser.id,
    metadata: { role: updatedUser.role },
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  });
  response.json({ data: updatedUser });
});

usersRouter.delete('/:id', async (request, response) => {
  if (request.auth?.profile.id === request.params.id) {
    throw new AppError(400, 'SELF_DELETE_NOT_ALLOWED', 'You cannot delete your own user account.');
  }
  await deleteUser(getSupabase(), request.params.id);
  await writeAuditLog(getSupabase(), {
    actorId: request.auth?.user.id,
    action: 'user.deleted',
    entityType: 'user',
    entityId: request.params.id,
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  });
  response.status(204).send();
});
