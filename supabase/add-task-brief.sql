-- Task Flow: a short brief and up to three links on each task.
-- Safe to run more than once.

alter table public.tasks add column if not exists link text;
alter table public.tasks add column if not exists brief text not null default '';
alter table public.tasks add column if not exists links jsonb not null default '[]'::jsonb;

-- Carry over links saved with the earlier single-link column.
update public.tasks
  set links = jsonb_build_array(jsonb_build_object('label', '', 'url', link))
  where link is not null and link <> '' and links = '[]'::jsonb;
