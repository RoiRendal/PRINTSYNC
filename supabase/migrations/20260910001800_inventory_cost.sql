alter table public.inventory_items add column if not exists cost_price numeric(12, 2) not null default 0 check (cost_price >= 0);
