"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Board, Option, Profile } from "@/lib/types";
import { Logo } from "./icons";
import { btnOutline, Spinner } from "./ui";

type Workspace = {
  me: Profile;
  isAdmin: boolean;
  profiles: Profile[];
  byId: Map<string, Profile>;
  statuses: Option[];
  /** Stages on offer here. Inside a board this is only that board's category. */
  stages: Option[];
  /** Every stage in every category, for showing names of stages set elsewhere. */
  allStages: Option[];
  categories: Option[];
  boards: Board[];
  reload: () => Promise<void>;
};

const Ctx = createContext<Workspace | null>(null);

/**
 * Inside a project: narrows `stages` to its category's list and `profiles` to
 * the people who can open it (used by the people pickers and @mentions).
 */
export function BoardScope({
  stages,
  profiles,
  children,
}: {
  stages: Option[];
  profiles: Profile[];
  children: React.ReactNode;
}) {
  const ws = useWorkspace();
  const value = useMemo(() => ({ ...ws, stages, profiles }), [ws, stages, profiles]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

type Data = {
  userId: string;
  email: string;
  profiles: Profile[];
  statuses: Option[];
  stages: Option[];
  categories: Option[];
  boards: Board[];
};

export async function signOut() {
  await supabase().auth.signOut();
  window.location.href = "/login";
}

/** Loads the team, statuses, stages and boards once and keeps them live. */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const sb = supabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const [p, s, st, b] = await Promise.all([
      sb.from("profiles").select("*").order("created_at"),
      sb.from("statuses").select("*").order("position"),
      sb.from("stages").select("*").order("position"),
      sb.from("boards").select("*").order("position").order("created_at"),
    ]);
    const err = p.error ?? s.error ?? st.error ?? b.error;
    if (err) {
      setError(err.message);
      return;
    }
    // Categories arrive with a later database update; without it the app runs with one shared stage list.
    const cat = await sb.from("categories").select("*").order("position");
    setError(null);
    setData({
      userId: user.id,
      email: user.email ?? "",
      profiles: p.data as Profile[],
      statuses: s.data as Option[],
      stages: st.data as Option[],
      categories: (cat.data ?? []) as Option[],
      boards: b.data as Board[],
    });
  }, []);

  useEffect(() => {
    reload();
    const sb = supabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(reload, 150);
    };
    const channel = sb.channel(`workspace-${Math.random()}`);
    for (const table of ["profiles", "statuses", "stages", "boards"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, soon);
    }
    channel.subscribe();
    // Tables added by later database updates get their own channels, so a
    // missing table can't break the main one. Being added to or removed from a
    // project changes which projects this person sees.
    const extra = ["categories", "board_members"].map((table) =>
      sb
        .channel(`${table}-${Math.random()}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, soon)
        .subscribe(),
    );
    return () => {
      clearTimeout(timer);
      sb.removeChannel(channel);
      extra.forEach((c) => sb.removeChannel(c));
    };
  }, [reload]);

  const value = useMemo<Workspace | null>(() => {
    if (!data) return null;
    const me = data.profiles.find((p) => p.id === data.userId);
    if (!me) return null;
    return {
      me,
      isAdmin: me.role === "admin",
      profiles: data.profiles,
      byId: new Map(data.profiles.map((p) => [p.id, p])),
      statuses: data.statuses,
      stages: data.stages,
      allStages: data.stages,
      categories: data.categories,
      boards: data.boards,
      reload,
    };
  }, [data, reload]);

  if (error) {
    return (
      <Screen>
        <h1 className="text-lg font-semibold">Can&apos;t reach the database</h1>
        <p className="text-sm text-muted">
          {error}. If this is a new project, run <code>supabase/schema.sql</code> in the Supabase SQL Editor.
        </p>
        <button className={btnOutline} onClick={() => reload()}>Try again</button>
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }
  if (!value) {
    return (
      <Screen>
        <h1 className="text-lg font-semibold">No access</h1>
        <p className="text-sm text-muted">
          {data.email} isn&apos;t a member of this FrameFlow workspace. Ask your admin to invite you.
        </p>
        <button className={btnOutline} onClick={signOut}>Sign out</button>
      </Screen>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo className="h-10 w-10" />
      {children}
    </div>
  );
}
