# Supabase Database

Migrations for the PRINTSYNC database live in `supabase/migrations`.

## Apply the migration

After installing the Supabase CLI and linking this repository to the Supabase project, run:

```text
supabase db push
```

The first migration creates the identity and authorization foundation:

- `profiles`, linked to `auth.users`
- normalized `roles`
- capability-based `permissions`
- `role_permissions`
- row-level security policies

The backend service role can manage these tables server-side, while browser clients remain subject to RLS. Do not put `SUPABASE_SERVICE_ROLE_KEY` in frontend environment variables.

This migration does not create application users. Users should be created through Supabase Auth and provisioned with a profile by a later backend workflow.

The next migration adds the `pos.read` permission and an append-only `audit_logs` table. Audit records capture authentication and user-management events, while passwords, access tokens, and refresh tokens are never stored. Audit logs are readable only by admins through database row-level security; the backend writes them with its service role.

The grants migration explicitly gives the backend service role access to the application tables. This is required for provisioning and user management when database role grants have been restricted on the project.

Audit writes use a narrowly scoped `SECURITY DEFINER` function so the backend does not need direct table-write privileges for `audit_logs`. Only the service role can execute that function.

## Provision an application user

After applying both migrations, create the first admin or repair a user's profile through the backend provisioning command. The command requires the service-role key and reads credentials only from local environment variables; it does not use the frontend mock users or commit passwords.

From the `backend` directory in PowerShell:

```powershell
$env:PROVISION_EMAIL = 'admin@printsync.com'
$env:PROVISION_PASSWORD = '<local-password-at-least-8-characters>'
$env:PROVISION_NAME = 'Irene Saquian'
$env:PROVISION_PHONE = '09171234567'
$env:PROVISION_POSITION = 'System Administrator'
$env:PROVISION_ROLE = 'admin'
npm run provision:user
```

Run the command again for the staff users by changing the identity fields and setting `PROVISION_ROLE` to `staff`. Existing accounts preserve their passwords unless `PROVISION_RESET_PASSWORD=true` is explicitly set. Clear the `PROVISION_*` variables after each run.
