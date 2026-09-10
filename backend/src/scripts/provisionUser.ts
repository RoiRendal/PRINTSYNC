import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { writeAuditLog } from '../services/auditLogService.js';

const inputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1),
  phone: z.string().trim().default(''),
  position: z.string().trim().default(''),
  role: z.enum(['admin', 'staff']),
  resetPassword: z.boolean().default(false),
});

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  const supabaseUrl = requiredEnvironment('SUPABASE_URL');
  const serviceRoleKey = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
  const input = inputSchema.parse({
    email: process.env.PROVISION_EMAIL,
    password: process.env.PROVISION_PASSWORD,
    name: process.env.PROVISION_NAME,
    phone: process.env.PROVISION_PHONE ?? '',
    position: process.env.PROVISION_POSITION ?? '',
    role: process.env.PROVISION_ROLE,
    resetPassword: process.env.PROVISION_RESET_PASSWORD === 'true',
  });
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', input.role)
    .single();
  if (roleError || !role) throw new Error(`The ${input.role} role is not configured. Apply the migrations first.`);

  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(`Could not inspect Auth users: ${listError.message}`);

  const normalizedEmail = input.email.toLowerCase();
  const existingUser = authUsers.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
  let userId: string;
  let operation: 'created' | 'updated';

  if (existingUser) {
    userId = existingUser.id;
    operation = 'updated';
    if (input.resetPassword) {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        email: normalizedEmail,
        password: input.password,
        email_confirm: true,
      });
      if (error) throw new Error(`Could not reset the existing user's password: ${error.message}`);
    }
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: input.password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`Could not create the Auth user: ${error?.message ?? 'unknown error'}`);
    userId = data.user.id;
    operation = 'created';
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    name: input.name,
    phone: input.phone,
    position: input.position,
    role_id: role.id,
  }, { onConflict: 'id' });

  if (profileError) {
    if (operation === 'created') await supabase.auth.admin.deleteUser(userId);
    throw new Error(`Could not provision the profile: ${profileError.message}`);
  }

  await writeAuditLog(supabase, {
    action: 'user.provisioned',
    entityType: 'user',
    entityId: userId,
    metadata: { email: normalizedEmail, role: input.role, operation },
  });

  console.log(`${operation === 'created' ? 'Created' : 'Updated'} ${normalizedEmail} (${input.role}) with profile ${userId}.`);
  if (existingUser && !input.resetPassword) {
    console.log('Existing password was preserved. Set PROVISION_RESET_PASSWORD=true to replace it.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'User provisioning failed.');
  process.exitCode = 1;
});