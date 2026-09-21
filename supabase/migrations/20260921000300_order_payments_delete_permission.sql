-- Deleting a recorded payment gets its own capability.
--
-- `DELETE /api/v1/order-payments/:id` was gated on `order_payments.create` — the
-- same key that authorises *recording* a payment. Any staff member who could take
-- a payment could therefore also erase one, with no separate grant and no way to
-- give a clerk the first without the second. Removing a payment moves the order's
-- balance due, so that is a bookkeeping correction, not a checkout action.
--
-- This mirrors how the sibling module already works: `payments.void` is its own
-- key, granted to `admin` only, precisely so that undoing a payment is not implied
-- by making one.
--
-- ORDERING: this migration must be applied **before** the matching route change
-- ships. The route is switched from `order_payments.create` to
-- `order_payments.delete` in the same commit; if the new code ran against a
-- database without this grant, every delete would 403 for everyone, including
-- admins. Applying the migration first is safe in the other direction — the old
-- code keeps checking a key that is still granted.

insert into public.permissions (key, description)
values
  ('order_payments.delete', 'Delete recorded order payments')
on conflict (key) do nothing;

-- Admin only. Staff deliberately keep `order_payments.create` and `read` and do
-- not gain this — that is the whole point of the change.
insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
join public.permissions on permissions.key in ('order_payments.delete')
where roles.name = 'admin'
on conflict do nothing;
