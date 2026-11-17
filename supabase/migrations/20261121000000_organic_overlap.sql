-- Paid vs organic overlap (check 17): record why Search Console data was or
-- wasn't available, so the audit can tell the owner how to unlock the check.
alter table public.audits
  add column organic_status text check (organic_status in ('ok', 'no_permission', 'no_site', 'error')),
  add column organic_site text;
