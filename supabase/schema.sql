-- Task Flow database schema.
-- Run once in Supabase → SQL Editor → New query → paste → Run.

create extension if not exists pgcrypto;

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  avatar text,
  color text not null default '#579bfc',
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create table public.invites (
  email text primary key,
  invited_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  position int not null default 0
);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  position int not null default 0
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo text,
  position int not null default 0,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  parent_id uuid references public.tasks(id) on delete cascade,
  title text not null default '',
  requestor_id uuid references public.profiles(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  start_date date,
  due_date date,
  status_id uuid references public.statuses(id) on delete set null,
  stage_id uuid references public.stages(id) on delete set null,
  link text,
  brief text not null default '',
  links jsonb not null default '[]'::jsonb,
  approval text not null default 'none' check (approval in ('none', 'pending', 'approved', 'changes')),
  position double precision not null default 0,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_board_idx on public.tasks(board_id);
create index tasks_parent_idx on public.tasks(parent_id);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  action text not null check (action in ('requested', 'approved', 'changes')),
  note text not null default '',
  actor_id uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index approvals_task_idx on public.approvals(task_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  body text not null,
  mentions uuid[] not null default '{}',
  reply_to uuid references public.comments(id) on delete set null,
  created_at timestamptz not null default now()
);
create index comments_task_idx on public.comments(task_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('assigned', 'mention', 'approval_requested', 'approval_approved', 'approval_changes')),
  task_id uuid references public.tasks(id) on delete cascade,
  body text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read);

-- ─── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ─── Signup: invite-only, first user becomes admin ───────────────────────────

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  first_user boolean;
  palette text[] := array['#579bfc','#00c875','#fdab3d','#e2445c','#a25ddc','#ff158a','#037f4c','#66ccff','#784bd1','#ff642e'];
begin
  select not exists (select 1 from profiles) into first_user;
  if not first_user and not exists (select 1 from invites where lower(email) = lower(new.email)) then
    raise exception 'This email has not been invited to Task Flow';
  end if;
  insert into profiles (id, email, full_name, color, role)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    palette[1 + floor(random() * array_length(palette, 1))::int],
    case when first_user then 'admin' else 'member' end
  );
  delete from invites where lower(email) = lower(new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins change roles; always keep at least one admin; email is read-only.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not is_admin() then
      raise exception 'Only admins can change roles';
    end if;
    if old.role = 'admin' and (select count(*) from profiles where role = 'admin') <= 1 then
      raise exception 'Task Flow needs at least one admin';
    end if;
  end if;
  new.email := old.email;
  return new;
end $$;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile();

-- ─── Task bookkeeping + notifications ────────────────────────────────────────

create or replace function public.touch_task() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger tasks_touch
  before update on public.tasks
  for each row execute function public.touch_task();

create or replace function public.notify_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null
     and new.owner_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id) then
    insert into notifications (user_id, actor_id, kind, task_id)
    values (new.owner_id, auth.uid(), 'assigned', new.id);
  end if;
  return new;
end $$;

create trigger tasks_notify_assignment
  after insert or update of owner_id on public.tasks
  for each row execute function public.notify_assignment();

-- Recording an approval event updates the task's approval state and notifies
-- the requestor (on request) or the owner (on decision).
create or replace function public.handle_approval() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t tasks;
begin
  select * into t from tasks where id = new.task_id;
  update tasks
    set approval = case new.action when 'requested' then 'pending' when 'approved' then 'approved' else 'changes' end
    where id = new.task_id;
  if new.action = 'requested' then
    if t.requestor_id is not null and t.requestor_id is distinct from new.actor_id then
      insert into notifications (user_id, actor_id, kind, task_id, body)
      values (t.requestor_id, new.actor_id, 'approval_requested', t.id, new.note);
    end if;
  elsif t.owner_id is not null and t.owner_id is distinct from new.actor_id then
    insert into notifications (user_id, actor_id, kind, task_id, body)
    values (t.owner_id, new.actor_id,
            case new.action when 'approved' then 'approval_approved' else 'approval_changes' end,
            t.id, new.note);
  end if;
  return new;
end $$;

create trigger approvals_handle
  after insert on public.approvals
  for each row execute function public.handle_approval();

create or replace function public.notify_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, kind, task_id, body)
  select distinct m, new.author_id, 'mention', new.task_id, left(new.body, 160)
  from unnest(new.mentions) as m
  where m is distinct from new.author_id
    and exists (select 1 from profiles where id = m);
  return new;
end $$;

create trigger comments_notify_mentions
  after insert on public.comments
  for each row execute function public.notify_mentions();

-- ─── Row level security ──────────────────────────────────────────────────────

alter table public.profiles      enable row level security;
alter table public.invites       enable row level security;
alter table public.statuses      enable row level security;
alter table public.stages        enable row level security;
alter table public.boards        enable row level security;
alter table public.tasks         enable row level security;
alter table public.approvals     enable row level security;
alter table public.comments      enable row level security;
alter table public.notifications enable row level security;

create policy "members read profiles" on public.profiles for select to authenticated using (is_member());
create policy "edit own profile or admin" on public.profiles for update to authenticated using (id = auth.uid() or is_admin());
create policy "admin removes members" on public.profiles for delete to authenticated using (is_admin() and id <> auth.uid());

create policy "members read invites" on public.invites for select to authenticated using (is_member());
create policy "admin creates invites" on public.invites for insert to authenticated with check (is_admin());
create policy "admin deletes invites" on public.invites for delete to authenticated using (is_admin());

create policy "members read statuses" on public.statuses for select to authenticated using (is_member());
create policy "admin writes statuses" on public.statuses for all to authenticated using (is_admin()) with check (is_admin());

create policy "members read stages" on public.stages for select to authenticated using (is_member());
create policy "admin writes stages" on public.stages for all to authenticated using (is_admin()) with check (is_admin());

create policy "members read boards" on public.boards for select to authenticated using (is_member());
create policy "members create boards" on public.boards for insert to authenticated with check (is_member());
create policy "members rename boards" on public.boards for update to authenticated using (is_member());
create policy "admin deletes boards" on public.boards for delete to authenticated using (is_admin());

create policy "members read tasks" on public.tasks for select to authenticated using (is_member());
create policy "members create tasks" on public.tasks for insert to authenticated with check (is_member());
create policy "members update tasks" on public.tasks for update to authenticated using (is_member());
create policy "members delete tasks" on public.tasks for delete to authenticated using (is_member());

create policy "members read approvals" on public.approvals for select to authenticated using (is_member());
create policy "request or decide approvals" on public.approvals for insert to authenticated with check (
  is_member()
  and actor_id = auth.uid()
  and (
    action = 'requested'
    or is_admin()
    or exists (select 1 from tasks where tasks.id = task_id and tasks.requestor_id = auth.uid())
  )
);

create policy "members read comments" on public.comments for select to authenticated using (is_member());
create policy "members write own comments" on public.comments for insert to authenticated with check (is_member() and author_id = auth.uid());
create policy "author or admin deletes comments" on public.comments for delete to authenticated using (author_id = auth.uid() or is_admin());

create policy "read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "delete own notifications" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ─── API access ──────────────────────────────────────────────────────────────
-- Signed-in users may reach these tables through the API; the policies above
-- decide which rows. Needed when "Automatically expose new tables" is off.

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.invites, public.statuses, public.stages, public.boards,
  public.tasks, public.approvals, public.comments, public.notifications
  to authenticated;
grant execute on function public.is_member(), public.is_admin() to authenticated;

-- ─── Realtime ────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table
  public.profiles, public.statuses, public.stages, public.boards,
  public.tasks, public.approvals, public.comments, public.notifications;

-- ─── Defaults (editable later in Settings) ───────────────────────────────────

insert into public.statuses (name, color, position) values
  ('Backlog', '#c4c4c4', 0),
  ('Todo',    '#579bfc', 1),
  ('Doing',   '#fdab3d', 2),
  ('Standby', '#a25ddc', 3),
  ('Blocked', '#e2445c', 4),
  ('Done',    '#00c875', 5);

insert into public.stages (name, color, position) values
  ('Script',     '#66ccff', 0),
  ('Moodboard',  '#ff7575', 1),
  ('Storyboard', '#fdab3d', 2),
  ('Animatic',   '#a25ddc', 3),
  ('Animation',  '#00c875', 4);
