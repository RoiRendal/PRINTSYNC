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
