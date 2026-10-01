-- FrameFlow: project categories. Each board belongs to one category, and each
-- category has its own list of stages. Safe to run more than once.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#6f74d8',
  position int not null default 0
);

alter table public.stages add column if not exists category_id uuid references public.categories(id) on delete cascade;
alter table public.boards add column if not exists category_id uuid references public.categories(id) on delete set null;

alter table public.categories enable row level security;
drop policy if exists "members read categories" on public.categories;
drop policy if exists "admin writes categories" on public.categories;
create policy "members read categories" on public.categories for select to authenticated using (is_member());
create policy "admin writes categories" on public.categories for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on public.categories to authenticated;

do $$
declare
  video uuid;
  brand uuid;
  web uuid;
  digital uuid;
begin
  if not exists (select 1 from public.categories) then
    alter publication supabase_realtime add table public.categories;

    insert into public.categories (name, color, position) values ('Video & Motion Design', '#6f74d8', 0) returning id into video;
    insert into public.categories (name, color, position) values ('Brand Identity', '#ff158a', 1) returning id into brand;
    insert into public.categories (name, color, position) values ('Web Design', '#00c875', 2) returning id into web;
    insert into public.categories (name, color, position) values ('Digital Design', '#fdab3d', 3) returning id into digital;

    -- Everything that exists today is video work.
    update public.stages set category_id = video where category_id is null;
    update public.boards set category_id = video where category_id is null;

    insert into public.stages (name, color, position, category_id) values
      ('Discovery',        '#66ccff', 0, brand),
      ('Moodboard',        '#ff7575', 1, brand),
      ('Concepts',         '#fdab3d', 2, brand),
      ('Refinement',       '#a25ddc', 3, brand),
      ('Brand Guidelines', '#579bfc', 4, brand),
      ('Final Files',      '#00c875', 5, brand),

      ('Sitemap',     '#66ccff', 0, web),
      ('Wireframes',  '#ff7575', 1, web),
      ('UI Design',   '#fdab3d', 2, web),
      ('Prototype',   '#a25ddc', 3, web),
      ('Development', '#579bfc', 4, web),
      ('Launch',      '#00c875', 5, web),

      ('Brief',        '#66ccff', 0, digital),
      ('Concepts',     '#ff7575', 1, digital),
      ('Design',       '#fdab3d', 2, digital),
      ('Revisions',    '#a25ddc', 3, digital),
      ('Final Export', '#00c875', 4, digital);
  end if;
end $$;
