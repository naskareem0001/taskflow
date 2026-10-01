"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkspaceProvider, signOut, useWorkspace } from "./workspace";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { NewBoardDialog } from "./BoardLogo";
import { CategoryIcon } from "./CategoryIcon";
import { Avatar, Popover } from "./ui";
import { IconBoard, IconLogout, IconMenu, IconPlus, IconSettings, Logo } from "./icons";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden md:gap-3 md:p-3">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border border-line/60 bg-panel/80 shadow-card backdrop-blur-xl transition-transform md:static md:translate-x-0 md:rounded-3xl ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar />
      </aside>
      {navOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setNavOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 shrink-0 items-center gap-2 px-3 md:px-6">
          <button className="rounded-full bg-panel/80 p-2.5 text-muted shadow-sm md:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <IconMenu className="h-5 w-5" />
          </button>
          <Greeting />
          <div className="flex-1" />
          <NotificationBell />
          <ThemeToggle />
          <UserMenu />
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function Greeting() {
  const { me } = useWorkspace();
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return (
    <div className="min-w-0 text-white">
      <p className="truncate text-xl font-medium md:text-2xl">
        Good {part}, {me.full_name.split(" ")[0]}.
      </p>
      <p className="hidden truncate text-sm text-white/80 sm:block">Here&apos;s where every brand&apos;s videos stand today.</p>
    </div>
  );
}

function Sidebar() {
  const { boards, categories, isAdmin } = useWorkspace();
  const pathname = usePathname();
  const [adding, setAdding] = useState(false);

  const link = (href: string, active: boolean) =>
    `flex items-center gap-2.5 rounded-full px-3 py-2 text-sm transition ${
      active ? "bg-accent font-medium text-accent-fg shadow-sm" : "text-fg hover:bg-hover"
    }`;

  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex h-16 items-center gap-2.5 px-5">
        <Logo />
        <span className="text-lg font-semibold tracking-tight">FrameFlow</span>
      </Link>

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="mb-1 flex items-center justify-between px-3 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Projects</span>
          {isAdmin && (
            <button onClick={() => setAdding(true)} className="rounded p-1 text-muted hover:bg-hover hover:text-fg" title="New project">
              <IconPlus />
            </button>
          )}
        </div>
        <ul className="space-y-0.5">
          {boards.map((b) => (
            <li key={b.id}>
              <Link href={`/board/${b.id}`} className={link(`/board/${b.id}`, pathname === `/board/${b.id}`)}>
                {b.logo ? (
                  <img src={b.logo} alt="" className="h-7 w-7 shrink-0 rounded-full bg-[#3d4080] object-cover object-left p-1" />
                ) : (
                  <IconBoard className="h-4 w-4 shrink-0 opacity-70" />
                )}
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <CategoryIcon category={categories.find((c) => c.id === b.category_id)} />
              </Link>
            </li>
          ))}
          {!boards.length && (
            <li className="px-3 py-2 text-sm text-muted">No projects yet.</li>
          )}
        </ul>
        {adding && <NewBoardDialog onClose={() => setAdding(false)} />}
      </nav>

      <div className="p-3">
        <Link href="/settings" className={link("/settings", pathname === "/settings")}>
          <IconSettings className="h-4 w-4 opacity-70" />
          Settings &amp; team
        </Link>
      </div>
    </div>
  );
}

function UserMenu() {
  const { me } = useWorkspace();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button onClick={(e) => setAnchor(anchor ? null : e.currentTarget)} className="ml-1 rounded-full" aria-label="Account">
        <Avatar profile={me} size={32} />
      </button>
      <Popover anchor={anchor} onClose={() => setAnchor(null)} width={240} align="end">
        <div className="px-2 py-1.5">
          <div className="truncate text-sm font-medium">{me.full_name}</div>
          <div className="truncate text-xs text-muted">{me.email}</div>
          <div className="mt-1 text-xs capitalize text-muted">{me.role}</div>
        </div>
        <div className="my-1 border-t border-line" />
        <Link href="/settings" onClick={() => setAnchor(null)} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hover">
          <IconSettings /> Settings
        </Link>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hover">
          <IconLogout /> Sign out
        </button>
      </Popover>
    </>
  );
}
