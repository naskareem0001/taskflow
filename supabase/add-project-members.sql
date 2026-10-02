-- Task Flow: per-project access. Admins see every project; members only see
-- the projects they have been added to. Safe to run more than once.

create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

-- People invited to a project before they have an account.
create table if not exists public.board_invites (
  email text not null,
  board_id uuid not null references public.boards(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (email, board_id)
);

-- ─── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.can_see_board(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
      or exists (select 1 from board_members where board_id = b and user_id = auth.uid());
$$;

-- True when the signed-in user is on at least one project with `other`.
create or replace function public.shares_board(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from board_members mine
    join board_members theirs using (board_id)
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

-- Adds an existing teammate to a project, or invites a new person by email so
-- that they join the project when they sign up. Returns 'added' or 'invited'.
create or replace function public.invite_to_board(p_board uuid, p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  e text := lower(trim(p_email));
begin
  if not is_admin() then
    raise exception 'Only admins can add people to a project';
  end if;
  if e = '' then
    raise exception 'Enter an email address';
  end if;
  select id into uid from profiles where lower(email) = e;
  if uid is not null then
    insert into board_members (board_id, user_id, added_by) values (p_board, uid, auth.uid()) on conflict do nothing;
    return 'added';
  end if;
  insert into invites (email, invited_by) values (e, auth.uid()) on conflict do nothing;
  insert into board_invites (email, board_id) values (e, p_board) on conflict do nothing;
  return 'invited';
end $$;

-- Withdraws a pending project invite; if it was their only one, they can no longer sign up.
create or replace function public.revoke_board_invite(p_board uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(trim(p_email));
begin
  if not is_admin() then
    raise exception 'Only admins can change project invites';
  end if;
  delete from board_invites where email = e and board_id = p_board;
  if not exists (select 1 from board_invites where email = e) then
    delete from invites where lower(email) = e;
  end if;
end $$;

-- Signup: as before (invite-only, first user is admin), and new people are put
-- on the projects they were invited to.
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
  insert into board_members (board_id, user_id)
    select board_id, new.id from board_invites where email = lower(new.email)
    on conflict do nothing;
  delete from board_invites where email = lower(new.email);
  delete from invites where lower(email) = lower(new.email);
  return new;
end $$;

-- ─── Security rules ──────────────────────────────────────────────────────────

alter table public.board_members enable row level security;
alter table public.board_invites enable row level security;

drop policy if exists "see members of visible projects" on public.board_members;
drop policy if exists "admin manages project members" on public.board_members;
create policy "see members of visible projects" on public.board_members for select to authenticated using (can_see_board(board_id));
create policy "admin manages project members" on public.board_members for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin manages project invites" on public.board_invites;
create policy "admin manages project invites" on public.board_invites for all to authenticated using (is_admin()) with check (is_admin());

-- Members only see themselves, admins, and people they share a project with.
drop policy if exists "members read profiles" on public.profiles;
create policy "members read profiles" on public.profiles for select to authenticated using (
  id = auth.uid() or role = 'admin' or is_admin() or shares_board(id)
);

-- Projects: visible to their people; created, edited and deleted by admins.
drop policy if exists "members read boards" on public.boards;
drop policy if exists "members create boards" on public.boards;
drop policy if exists "members rename boards" on public.boards;
drop policy if exists "admin creates boards" on public.boards;
drop policy if exists "admin edits boards" on public.boards;
create policy "members read boards" on public.boards for select to authenticated using (can_see_board(id));
create policy "admin creates boards" on public.boards for insert to authenticated with check (is_admin());
create policy "admin edits boards" on public.boards for update to authenticated using (is_admin());

-- Tasks, approvals and comments follow the project they belong to.
drop policy if exists "members read tasks" on public.tasks;
drop policy if exists "members create tasks" on public.tasks;
drop policy if exists "members update tasks" on public.tasks;
drop policy if exists "members delete tasks" on public.tasks;
create policy "members read tasks" on public.tasks for select to authenticated using (can_see_board(board_id));
create policy "members create tasks" on public.tasks for insert to authenticated with check (can_see_board(board_id));
create policy "members update tasks" on public.tasks for update to authenticated using (can_see_board(board_id));
create policy "members delete tasks" on public.tasks for delete to authenticated using (can_see_board(board_id));

drop policy if exists "members read approvals" on public.approvals;
drop policy if exists "request or decide approvals" on public.approvals;
create policy "members read approvals" on public.approvals for select to authenticated using (
  exists (select 1 from tasks t where t.id = task_id and can_see_board(t.board_id))
);
create policy "request or decide approvals" on public.approvals for insert to authenticated with check (
  actor_id = auth.uid()
  and exists (select 1 from tasks t where t.id = task_id and can_see_board(t.board_id))
  and (
    action = 'requested'
    or is_admin()
    or exists (select 1 from tasks t where t.id = task_id and t.requestor_id = auth.uid())
  )
);

drop policy if exists "members read comments" on public.comments;
drop policy if exists "members write own comments" on public.comments;
create policy "members read comments" on public.comments for select to authenticated using (
  exists (select 1 from tasks t where t.id = task_id and can_see_board(t.board_id))
);
create policy "members write own comments" on public.comments for insert to authenticated with check (
  author_id = auth.uid()
  and exists (select 1 from tasks t where t.id = task_id and can_see_board(t.board_id))
);

-- ─── API access + live updates ───────────────────────────────────────────────

grant select, insert, update, delete on public.board_members, public.board_invites to authenticated;
grant execute on function
  public.can_see_board(uuid), public.shares_board(uuid),
  public.invite_to_board(uuid, text), public.revoke_board_invite(uuid, text)
  to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board_members'
  ) then
    alter publication supabase_realtime add table public.board_members;
  end if;
end $$;
