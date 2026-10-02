-- Task Flow: a start date on tasks and subitems. Safe to run more than once.

alter table public.tasks add column if not exists start_date date;
