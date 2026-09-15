alter table public.business_settings add column if not exists vat_rate numeric(5, 2) not null default 12 check (vat_rate >= 0);
alter table public.business_settings add column if not exists currency_symbol text not null default '₱' check (length(currency_symbol) > 0);
