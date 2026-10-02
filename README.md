# Task Flow

Project tracker for a creative studio. One project per brand and category (Video & Motion
Design, Brand Identity, Web Design, Digital Design); each category has its own stages, and a
task's subitems are those stages. Tasks are grouped by status, with requestor/owner, due dates,
an approval flow, threaded chat with @mentions, an in-app notification bell, and per-project
access. Live updates for everyone via Supabase Realtime.

Stack: Next.js 15 · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, Realtime) · Vercel.

## 1. Supabase (database + logins)

1. Create a free project at https://supabase.com.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   Then do the same with `supabase/add-categories.sql` (project categories and their stages)
   and `supabase/add-project-members.sql` (members only see the projects they're added to).
3. **Authentication → Sign In / Providers → Email**: turn **off** "Confirm email" (recommended —
   Task Flow is invite-only, and Supabase's built-in mailer only sends a few emails per hour).
4. **Project Settings → API**: copy the Project URL and the anon / publishable key.

## 2. Run locally

```bash
cp .env.local.example .env.local   # then paste the two values
npm install
npm run dev
```

Open http://localhost:3000. **The first account created becomes the admin.**

## 3. Invite the team

Settings & team → Invite → enter their email. Send them the `/login` link; they choose
"Create account" with that same email. Uninvited emails are rejected by the database.

## 4. Deploy (Vercel)

1. Push this folder to a GitHub repo.
2. https://vercel.com → Add New Project → import the repo.
3. Add the two env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) → Deploy.
4. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel URL.

## How it works

| Concept | Where |
| --- | --- |
| Tables, security rules, notification triggers, default stages/statuses | `supabase/schema.sql` |
| Board table, groups, filters, realtime | `components/board/BoardView.tsx` |
| Row + cells (stage/status dropdowns, people, dates) | `components/board/TaskRow.tsx`, `cells.tsx` |
| Side panel: approval flow + updates/@mentions | `components/board/TaskPanel.tsx` |
| Team, invites, editable stages/statuses | `app/(app)/settings/page.tsx` |

Roles: **Admin** invites/removes people, changes roles, edits stages & statuses, deletes boards.
**Member** creates boards and tasks, edits everything on a board, comments, requests approvals.
Only the task's **requestor** (or an admin) can approve or request changes.
