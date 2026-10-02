/**
 * Provisions one PrintSync account: an Auth user plus its profile row.
 *
 * Run with:  npm run provision:user   (from the backend workspace)
 *
 * Read from the environment:
 *
 *   SUPABASE_URL               required
 *   SUPABASE_SERVICE_ROLE_KEY  required
 *   PROVISION_EMAIL            required
 *   PROVISION_PASSWORD         required, min 8 characters
 *   PROVISION_NAME             required
 *   PROVISION_PHONE            optional
 *   PROVISION_POSITION         optional
 *   PROVISION_ROLE             admin | staff | owner   (default staff)
 *   PROVISION_BRANCH           required — a branch code (BAL, NAS) or a branch uuid
 *   PROVISION_RESET_PASSWORD   'true' to replace an existing user's password
 *
 * ## Why this script had to learn about branches
 *
 * Two-branch rollout, phase 1..4. Before it, this script wrote a profile with no
 * `branch_id` and only knew the `admin` and `staff` roles. That was survivable
 * only while `profiles.branch_id` was nullable, which phase 1 arranged on purpose
 * so provisioning would keep working. Phase 2 then tightened the column to NOT
 * NULL — at which point this script stopped being able to create anybody: the
 * profile upsert is rejected and the auth user it just created is deleted again
 * on the way out. There was briefly no sanctioned way to create an account at all.
 *
 * It also could not create the account the whole rollout was for. Head office is
 * not a role in the sense `admin` is: `can_view_all_branches` is set only when the
 * role is `owner` — see `modules/users/users.service.ts`, which derives it the same
 * way. So an account provisioned as `admin` gets single-branch analytics and no
 * branch selector, which is every part of phase 4 withheld.
 *
 * ## Why PROVISION_BRANCH accepts a code as well as a uuid
 *
 * A uuid is unreadable at the call site and differs per project, so a script or a
 * runbook that hard-codes one is subtly wrong the moment the project is recreated.
 * `BAL` / `NAS` are the codes the owner already uses for document references, and
 * they are what a person typing this command can verify at a glance. The uuid is
 * accepted too, because it is what an automated caller already has.
 *
 * ## What this script deliberately does NOT do
 *
 * It does not invent a branch when one is missing. A profile with no branch is an
 * account that can sign in and see nothing, and defaulting to Balayan is how a
 * Nasugbu hire ends up looking at the wrong shop's stock. An absent or unknown
 * branch is an error, and the command fails.
 *
 * It never touches `roles`, `permissions`, `role_permissions` or `branches`. Those
 * are migrations' business.
 */

import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { writeAuditLog } from '../services/auditLogService.js';

const inputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1),
  phone: z.string().trim().default(''),
  position: z.string().trim().default(''),
  // `owner` is the head-office role the owner asked for ("a role several people
  // share"). It is spelled here rather than left to the users API so a fresh
  // install can create its first head-office account without a signed-in admin —
  // which is a chicken-and-egg problem otherwise, since the Users screen needs a
  // session before it can create one.
  role: z.enum(['admin', 'staff', 'owner']),
  branch: z.string().trim().min(1),
  resetPassword: z.boolean().default(false),
});

/** A branch as this script needs it: the id to write, the code to report. */
interface ResolvedBranch {
  id: string;
  code: string;
  name: string;
}

/** Matches the `code` check constraint in `20261002000200_branches.sql`. */
const BRANCH_CODE = /^[A-Z][A-Z0-9]{1,7}$/;

const BRANCH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

/**
 * Turns the value of `PROVISION_BRANCH` into a real branch row.
 *
 * The distinction between "no such branch" and "that branch exists but is
 * inactive" is preserved rather than collapsed into one message, because they
 * call for different fixes: the first is a typo, the second is a decision.
 */
async function resolveBranch(supabase: SupabaseClient, requested: string): Promise<ResolvedBranch> {
  const byCode = BRANCH_CODE.test(requested);
  const byId = !byCode && BRANCH_UUID.test(requested);

  if (!byCode && !byId) {
    throw new Error(
      `PROVISION_BRANCH must be a branch code such as BAL or NAS, or a branch uuid. Received "${requested}".`,
    );
  }

  const query = supabase.from('branches').select('id, code, name, is_active');
  const { data, error } = byCode
    ? await query.eq('code', requested.toUpperCase()).maybeSingle()
    : await query.eq('id', requested).maybeSingle();

  if (error) throw new Error(`Could not look up the branch: ${error.message}`);

  if (!data) {
    // List what does exist. Without this, a typo produces "not found" and the
    // caller has to go and query the table to find out what the right value was.
    const { data: available } = await supabase.from('branches').select('code, name').order('code');
    const list = available?.map((branch) => `${branch.code} (${branch.name})`).join(', ') || 'none';
    throw new Error(`No branch matches "${requested}". Configured branches: ${list}.`);
  }

  const branch = data as { id: string; code: string; name: string; is_active: boolean };
  if (!branch.is_active) {
    throw new Error(
      `Branch ${branch.code} (${branch.name}) is inactive, so no account should be assigned to it. ` +
        'Reactivate the branch first, or choose another.',
    );
  }

  return { id: branch.id, code: branch.code, name: branch.name };
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
    role: process.env.PROVISION_ROLE ?? 'staff',
    branch: process.env.PROVISION_BRANCH,
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
  if (roleError || !role) {
    const { data: configuredRoles } = await supabase.from('roles').select('name').order('name');
    const roleNames = configuredRoles?.map((configuredRole) => configuredRole.name).join(', ') || 'none';
    throw new Error(
      `The ${input.role} role is not configured. Database error: ${roleError?.message ?? 'role not found'}. Configured roles: ${roleNames}.`,
    );
  }

  // Resolved before the auth user is created, so a bad branch cannot leave an
  // auth row behind — the profile write is the step that would fail, and this
  // removes the reason it would.
  const branch = await resolveBranch(supabase, input.branch);

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
    branch_id: branch.id,
    // Derived from the role, never accepted as its own input — the same rule the
    // users service applies. Letting a second place set this flag by hand is how
    // "can see both branches" quietly becomes a thing anybody can grant.
    can_view_all_branches: input.role === 'owner',
  }, { onConflict: 'id' });

  if (profileError) {
    // Roll back a freshly created auth user: an auth row with no profile cannot
    // sign in (the login path rejects it as unprovisioned) and cannot be repaired
    // by re-running the command with `createUser`, because the email is taken.
    if (operation === 'created') await supabase.auth.admin.deleteUser(userId);
    throw new Error(`Could not provision the profile: ${profileError.message}`);
  }

  await writeAuditLog(supabase, {
    action: 'user.provisioned',
    entityType: 'user',
    entityId: userId,
    // The branch is recorded as both id and code. The id is what joins; the code
    // is what a person reading the audit trail in six months will recognise.
    metadata: { email: normalizedEmail, role: input.role, branchId: branch.id, branchCode: branch.code, operation },
  });

  console.log(
    `${operation === 'created' ? 'Created' : 'Updated'} ${normalizedEmail} ` +
      `(${input.role}) at ${branch.code} — ${branch.name}. Profile ${userId}.`,
  );
  if (input.role === 'owner') {
    console.log('Owner: can read analytics across every branch. This does not grant cross-branch writes.');
  }
  if (existingUser && !input.resetPassword) {
    console.log('Existing password was preserved. Set PROVISION_RESET_PASSWORD=true to replace it.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'User provisioning failed.');
  process.exitCode = 1;
});
