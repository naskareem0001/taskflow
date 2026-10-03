-- Task Flow: a small profile picture per person. Safe to run more than once.

alter table public.profiles add column if not exists avatar text;
