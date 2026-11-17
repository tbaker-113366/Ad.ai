-- Weekly "things to improve" email.
alter table public.audits add column report_emailed_at timestamptz;
alter table public.business_profiles add column weekly_email boolean not null default true;
