import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdminClient } from '../integrations/supabase/adminClient.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { AppError } from '../shared/errors.js';
import { createUser, deleteUser, listUsers, updateUser } from '../modules/users/users.service.js';

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

usersRouter.get('/', async (_request, response) => {
  response.json({ data: await listUsers(getSupabase()) });
});

usersRouter.post('/', async (request, response) => {
  const parsed = userSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_USER_REQUEST', 'The user details are invalid.');
  response.status(201).json({ data: await createUser(getSupabase(), parsed.data) });
});

usersRouter.patch('/:id', async (request, response) => {
  const parsed = userSchema.safeParse(request.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_USER_REQUEST', 'The user details are invalid.');
  response.json({ data: await updateUser(getSupabase(), request.params.id, parsed.data) });
});

usersRouter.delete('/:id', async (request, response) => {
  if (request.auth?.profile.id === request.params.id) {
    throw new AppError(400, 'SELF_DELETE_NOT_ALLOWED', 'You cannot delete your own user account.');
  }
  await deleteUser(getSupabase(), request.params.id);
  response.status(204).send();
});
