"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { Option, Task } from "@/lib/types";
import { BoardScope, useWorkspace } from "../workspace";
import { Avatar, InlineText, Popover, Spinner, btnGhost, btnOutline, btnPrimary } from "../ui";
import { IconCalendar, IconColumns, IconCheck, IconChevron, IconDots, IconFilter, IconLayers, IconPerson, IconPlus, IconSearch, IconTrash, IconX } from "../icons";
import { AddStageRow, HeaderRow, TaskRow } from "./TaskRow";
import { TaskPanel, type PanelView } from "./TaskPanel";
import { fileToLogo, logoError } from "../BoardLogo";
import { CategoryIcon } from "../CategoryIcon";
import { ProjectPeople } from "./ProjectPeople";
import { NewTaskDialog, type NewTask } from "./NewTaskDialog";
import { BoardCalendar } from "./BoardCalendar";
import { BoardKanban } from "./BoardKanban";
import { confirmDialog, notify } from "../dialogs";

type Change = RealtimePostgresChangesPayload<Record<string, unknown>>;

// Some columns arrive with later database updates; explain that instead of a raw column error.
const briefHint = (message: string) =>
  /start_date/i.test(message)
    ? "Start dates need a one-time database update. Ask your admin to run supabase/add-start-date.sql in the Supabase SQL Editor."
    : /'(brief|links|link)' column|column .*(brief|links)/i.test(message)
      ? "Briefs and links need a one-time database update. Ask your admin to run supabase/add-task-brief.sql in the Supabase SQL Editor."
      : message;

const byPosition = (a: Task, b: Task) => a.position - b.position || a.created_at.localeCompare(b.created_at);
const NO_STATUS = "none";
const HIDDEN_KEY = "ff-hidden-statuses";
const VIEW_KEY = "ff-board-view";
// Statuses the "Active only" shortcut hides.
const INACTIVE = ["backlog", "standby", "done"];
// Subitem statuses that count as "started" when working out a task's stage.
const STARTED = ["doing", "done"];

export default function BoardView({ boardId }: { boardId: string }) {
  const { boards, statuses, stages: allStages, categories, profiles, byId, me, isAdmin } = useWorkspace();
  const board = boards.find((b) => b.id === boardId);
  // A board only offers the stages of its own project category.
  const category = categories.find((c) => c.id === board?.category_id);
  const stages = useMemo(
    () => (category ? allStages.filter((s) => s.category_id === category.id) : allStages),
    [allStages, category],
  );
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("task");
  const openView: PanelView = params.get("view") === "approval" ? "approval" : "chat";
  // The group a new task is being created in (the New task dialog is open while set).
  const [newTaskIn, setNewTaskIn] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [personAnchor, setPersonAnchor] = useState<HTMLElement | null>(null);
  const [stageAnchor, setStageAnchor] = useState<HTMLElement | null>(null);
  const [boardMenu, setBoardMenu] = useState<HTMLElement | null>(null);
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Who has been added to this project. null = per-project access isn't set up, so everyone counts.
  const [memberIds, setMemberIds] = useState<string[] | null>(null);

  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase().from("board_members").select("user_id").eq("board_id", boardId);
    setMemberIds(error ? null : ((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  }, [boardId]);

  useEffect(() => {
    loadMembers();
    const sb = supabase();
    const channel = sb
      .channel(`board-members-${boardId}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_members" }, loadMembers)
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [boardId, loadMembers]);

  // People who can open this project: its members plus every admin.
  const people = useMemo(
    () => (memberIds ? profiles.filter((p) => p.role === "admin" || memberIds.includes(p.id)) : profiles),
    [profiles, memberIds],
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Status groups this person has chosen to hide (remembered in this browser).
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Table (status groups), Board (To do / Doing / Done columns) or Calendar; remembered in this browser.
  const [view, setView] = useState<"table" | "board" | "calendar">("table");
  const calendar = view === "calendar";
  const kanban = view === "board";

  useEffect(() => {
    try {
      setHidden(new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]") as string[]));
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "calendar" || saved === "board") setView(saved);
    } catch {}
  }, []);

  // Clicking the active view's button goes back to the table.
  const showView = (next: "board" | "calendar") => {
    const v = view === next ? "table" : next;
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const saveHidden = (next: Set<string>) => {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {}
  };

  // ─── Data ────────────────────────────────────────────────────────────────
  const upsert = useCallback(
    (t: Task) =>
      setTasks((ts) => {
        const i = ts.findIndex((x) => x.id === t.id);
        if (i === -1) return [...ts, t];
        const next = ts.slice();
        next[i] = { ...next[i], ...t };
        return next;
      }),
    [],
  );

  const loadCounts = useCallback(async () => {
    const { data } = await supabase()
      .from("comments")
      .select("task_id, tasks!inner(board_id)")
      .eq("tasks.board_id", boardId);
    const c: Record<string, number> = {};
    for (const row of (data ?? []) as { task_id: string }[]) c[row.task_id] = (c[row.task_id] ?? 0) + 1;
    setCounts(c);
  }, [boardId]);

  const load = useCallback(async () => {
    const { data, error } = await supabase().from("tasks").select("*").eq("board_id", boardId).order("position");
    if (error) return notify(error.message);
    setTasks(data as Task[]);
    setLoaded(true);
    loadCounts();
  }, [boardId, loadCounts]);

  useEffect(() => {
    setLoaded(false);
    setTasks([]);
    load();
    const sb = supabase();
    const filter = `board_id=eq.${boardId}`;
    const channel = sb
      .channel(`board-${boardId}-${Math.random()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks", filter }, (p: Change) => upsert(p.new as Task))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter }, (p: Change) => upsert(p.new as Task))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, (p: Change) => {
        const id = (p.old as { id?: string }).id;
        if (id) setTasks((ts) => ts.filter((t) => t.id !== id && t.parent_id !== id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, (p: Change) => {
        const taskId = (p.new as { task_id: string }).task_id;
        setCounts((c) => ({ ...c, [taskId]: (c[taskId] ?? 0) + 1 }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "comments" }, () => loadCounts())
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [boardId, load, loadCounts, upsert]);

  const patchLocal = useCallback(
    (id: string, patch: Partial<Task>) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [],
  );

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // A task's stage is the stage of its last subitem that has been started
  // (status Doing or Done). Subitems still waiting in Todo etc. don't count.
  const syncParentStage = useCallback(
    (parentId: string, list: Task[]) => {
      const started = list
        .filter((t) => t.parent_id === parentId)
        .sort(byPosition)
        .filter((k) => STARTED.includes(statuses.find((s) => s.id === k.status_id)?.name.trim().toLowerCase() ?? ""));
      const stage_id = started.length ? started[started.length - 1].stage_id : null;
      const parent = list.find((t) => t.id === parentId);
      if (!parent || parent.stage_id === stage_id) return;
      patchLocal(parentId, { stage_id });
      supabase().from("tasks").update({ stage_id }).eq("id", parentId).then();
    },
    [statuses, patchLocal],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Task>) => {
      patchLocal(id, patch);
      if ("stage_id" in patch || "status_id" in patch) {
        const list = tasksRef.current.map((t) => (t.id === id ? { ...t, ...patch } : t));
        const parentId = list.find((t) => t.id === id)?.parent_id;
        if (parentId) syncParentStage(parentId, list);
      }
      const { error } = await supabase().from("tasks").update(patch).eq("id", id);
      if (error) {
        notify(briefHint(error.message));
        load();
      }
    },
    [patchLocal, load, syncParentStage],
  );

  const create = async (fields: Partial<Task>, focus = false) => {
    const { data, error } = await supabase()
      .from("tasks")
      .insert({ board_id: boardId, requestor_id: me.id, ...fields })
      .select()
      .single();
    if (error) return notify(briefHint(error.message));
    upsert(data as Task);
    if (focus) setFresh((data as Task).id);
    return data as Task;
  };

  const remove = async (id: string) => {
    const t = tasks.find((x) => x.id === id);
    const kids = tasks.filter((x) => x.parent_id === id).length;
    const extra = kids ? ` and its ${kids} subitem${kids > 1 ? "s" : ""}` : "";
    if (!(await confirmDialog(`Delete “${t?.title || "this task"}”${extra}?`))) return;
    setTasks((ts) => ts.filter((x) => x.id !== id && x.parent_id !== id));
    if (openId === id) openTask(null);
    if (t?.parent_id) syncParentStage(t.parent_id, tasks.filter((x) => x.id !== id));
    const { error } = await supabase().from("tasks").delete().eq("id", id);
    if (error) {
      notify(error.message);
      load();
    }
  };

  useEffect(() => {
    if (fresh) setFresh(null);
  }, [fresh]);

  const select = (ids: string[], on: boolean) => {
    setConfirmingDelete(false);
    setSelected((cur) => {
      const next = new Set(cur);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  };

  // Deletes every ticked task and subitem. Deleting a task takes its subitems with it.
  const removeSelected = async () => {
    const ids = [...selected].filter((id) => tasks.some((t) => t.id === id));
    const gone = (t: Task) => selected.has(t.id) || (!!t.parent_id && selected.has(t.parent_id));
    const rest = tasks.filter((t) => !gone(t));
    const parents = new Set(tasks.filter((t) => gone(t) && t.parent_id && !selected.has(t.parent_id)).map((t) => t.parent_id as string));
    setTasks(rest);
    setSelected(new Set());
    setConfirmingDelete(false);
    if (openId && !rest.some((t) => t.id === openId)) openTask(null);
    parents.forEach((p) => syncParentStage(p, rest));
    const { error } = await supabase().from("tasks").delete().in("id", ids);
    if (error) {
      notify(error.message);
      load();
    }
  };

  const openTask = (id: string | null, view: PanelView = "chat") =>
    router.replace(
      id ? `/board/${boardId}?task=${id}${view === "chat" ? "" : `&view=${view}`}` : `/board/${boardId}`,
      { scroll: false },
    );

  // ─── Derived ─────────────────────────────────────────────────────────────
  const todo = statuses.find((s) => s.name.trim().toLowerCase() === "todo") ?? statuses[0];
  const top = useMemo(() => tasks.filter((t) => !t.parent_id).sort(byPosition), [tasks]);
  const childrenOf = useCallback((id: string) => tasks.filter((t) => t.parent_id === id).sort(byPosition), [tasks]);

  const filtering = !!(query.trim() || person || stage);
  const q = query.trim().toLowerCase();
  const matches = (t: Task) =>
    (!q || t.title.toLowerCase().includes(q)) &&
    (!person || t.owner_id === person || t.requestor_id === person) &&
    (!stage || t.stage_id === stage);

  const visibleTop = filtering ? top.filter((t) => matches(t) || childrenOf(t.id).some(matches)) : top;

  const groups = [
    ...statuses.map((s) => ({ key: s.id, name: s.name, color: s.color })),
    { key: NO_STATUS, name: "No status", color: "#797e93" },
  ]
    .map((g) => ({
      ...g,
      tasks: visibleTop.filter((t) => (t.status_id && statuses.some((s) => s.id === t.status_id) ? t.status_id : NO_STATUS) === g.key),
    }))
    .filter((g) => (g.key !== NO_STATUS || g.tasks.length) && !hidden.has(g.key));

  const hiddenCount = statuses.filter((s) => hidden.has(s.id)).length;
  const inactiveIds = statuses.filter((s) => INACTIVE.includes(s.name.trim().toLowerCase())).map((s) => s.id);
  const activeOnly = hiddenCount > 0 && hiddenCount === inactiveIds.length && inactiveIds.every((id) => hidden.has(id));

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const maxPos = (list: Task[]) => list.reduce((m, t) => Math.max(m, t.position), 0);

  // "New task" and the "+" beside a group both open the New task dialog for that group.
  const newTask = () => setNewTaskIn(todo?.id ?? NO_STATUS);
  const addInGroup = (key: string) => setNewTaskIn(key);

  const createFromDialog = async (key: string, fields: NewTask) => {
    setCollapsed((c) => {
      const next = new Set(c);
      next.delete(key);
      return next;
    });
    const made = await create({
      title: fields.title,
      // Only sent when filled in, so plain tasks don't depend on the brief/links columns existing.
      ...(fields.brief ? { brief: fields.brief } : {}),
      ...(fields.links.length ? { links: fields.links } : {}),
      status_id: key === NO_STATUS ? null : key,
      position: maxPos(top) + 1,
    });
    return !!made;
  };

  const addSub = async (parent: Task, stage: Option) => {
    const sub = await create({
      title: stage.name,
      stage_id: stage.id,
      parent_id: parent.id,
      status_id: todo?.id ?? null,
      requestor_id: parent.requestor_id ?? me.id,
      position: maxPos(childrenOf(parent.id)) + 1,
    });
    if (sub) syncParentStage(parent.id, [...tasksRef.current.filter((t) => t.id !== sub.id), sub]);
  };

  const logoInput = useRef<HTMLInputElement>(null);
  const saveLogo = async (logo: string | null) => {
    const { error } = await supabase().from("boards").update({ logo }).eq("id", boardId);
    if (error) notify(logoError(error.message));
  };

  const openTaskObj = openId ? tasks.find((t) => t.id === openId) : undefined;

  if (!board) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-muted">This project doesn&apos;t exist or was deleted.</p>
        <button className={btnOutline} onClick={() => router.push("/")}>Go home</button>
      </div>
    );
  }

  const personFilter = person ? byId.get(person) : undefined;
  const stageFilter = stage ? stages.find((s) => s.id === stage) : undefined;

  return (
    <BoardScope stages={stages} profiles={people}>
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="px-4 pt-3 md:px-6">
        {board.logo && (
          <div className="mb-5 flex h-28 items-center rounded-3xl bg-gradient-to-br from-[#585cab] to-[#2e3070] px-7 shadow-card">
            <img src={board.logo} alt={`${board.name} logo`} className="max-h-16 max-w-[70%] object-contain" />
          </div>
        )}
        <input
          ref={logoInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              await saveLogo(await fileToLogo(file));
            } catch {
              notify("That file couldn't be read as an image. Try a PNG, JPG or SVG.");
            }
          }}
        />
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <InlineText
              value={board.name}
              onSave={async (name) => {
                const { error } = await supabase().from("boards").update({ name }).eq("id", board.id);
                if (error) notify(error.message);
              }}
              className="text-2xl font-semibold md:text-3xl"
            />
          ) : (
            <h1 className="px-1.5 text-2xl font-semibold md:text-3xl">{board.name}</h1>
          )}
          {category && (
            <span className="flex items-center gap-1.5 rounded-full bg-panel/70 py-1 pl-1 pr-3 text-xs font-medium shadow-sm">
              <CategoryIcon category={category} size={20} />
              {category.name}
            </span>
          )}
          {isAdmin && (
            <>
              <button onClick={(e) => setBoardMenu(boardMenu ? null : e.currentTarget)} className="rounded p-1.5 text-muted hover:bg-hover" title="Project options">
                <IconDots className="h-5 w-5" />
              </button>
              <Popover anchor={boardMenu} onClose={() => setBoardMenu(null)} width={230} align="start">
                <button
                  onClick={() => { setBoardMenu(null); logoInput.current?.click(); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hover"
                >
                  <IconPlus /> {board.logo ? "Change logo" : "Upload logo"}
                </button>
                {board.logo && (
                  <button
                    onClick={() => { setBoardMenu(null); saveLogo(null); }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hover"
                  >
                    <IconX /> Remove logo
                  </button>
                )}
                {categories.length > 0 && (
                  <div className="my-1 border-y border-line py-1">
                    <p className="px-2 py-1 text-xs text-muted">Project category</p>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={async () => {
                          setBoardMenu(null);
                          if (c.id === board.category_id) return;
                          const { error } = await supabase().from("boards").update({ category_id: c.id }).eq("id", board.id);
                          if (error) notify(error.message);
                        }}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hover ${c.id === board.category_id ? "font-medium" : ""}`}
                      >
                        <CategoryIcon category={c} size={18} />
                        <span className="flex-1 truncate text-left">{c.name}</span>
                        {c.id === board.category_id && <IconCheck className="h-4 w-4 text-accent" />}
                      </button>
                    ))}
                  </div>
                )}
                {isAdmin && <button
                  onClick={async () => {
                    setBoardMenu(null);
                    if (!(await confirmDialog(`Delete project “${board.name}” and all of its tasks? This can't be undone.`))) return;
                    const { error } = await supabase().from("boards").delete().eq("id", board.id);
                    if (error) return notify(error.message);
                    router.push("/");
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-red-500 hover:bg-hover"
                >
                  <IconTrash /> Delete project
                </button>}
              </Popover>
            </>
          )}
        </div>

        {/* Toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={newTask} className={btnPrimary}>
            <IconPlus /> New task
          </button>
          <label className="flex items-center gap-1.5 rounded-full border border-transparent bg-panel/70 px-3.5 py-2 shadow-sm focus-within:border-accent">
            <IconSearch className="h-4 w-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-36 bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </label>
          <button onClick={(e) => setPersonAnchor(personAnchor ? null : e.currentTarget)} className={`${btnGhost} ${person ? "!bg-accent !text-accent-fg" : ""}`}>
            {personFilter ? <Avatar profile={personFilter} size={20} /> : <IconPerson />}
            {personFilter ? personFilter.full_name.split(" ")[0] : "Person"}
          </button>
          <Popover anchor={personAnchor} onClose={() => setPersonAnchor(null)} width={240} align="start">
            <p className="px-2 pb-1 text-xs text-muted">Show tasks where this person is owner or requestor</p>
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => { setPerson(p.id === person ? null : p.id); setPersonAnchor(null); }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hover ${p.id === person ? "bg-hover" : ""}`}
              >
                <Avatar profile={p} size={22} /> <span className="truncate">{p.full_name}</span>
              </button>
            ))}
          </Popover>
          <button onClick={(e) => setStageAnchor(stageAnchor ? null : e.currentTarget)} className={`${btnGhost} ${stage ? "!bg-accent !text-accent-fg" : ""}`}>
            <IconLayers />
            {stageFilter ? stageFilter.name : "Stage"}
          </button>
          <Popover anchor={stageAnchor} onClose={() => setStageAnchor(null)} width={200} align="start">
            <div className="flex flex-col gap-1.5">
              {stages.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setStage(s.id === stage ? null : s.id); setStageAnchor(null); }}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 ${s.id === stage ? "ring-2 ring-fg" : ""}`}
                  style={{ background: s.color }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </Popover>
          <button onClick={(e) => setStatusAnchor(statusAnchor ? null : e.currentTarget)} className={`${btnGhost} ${hiddenCount ? "!bg-accent !text-accent-fg" : ""}`}>
            <IconFilter />
            {activeOnly ? "Active only" : hiddenCount ? `${statuses.length - hiddenCount} of ${statuses.length} statuses` : "Status"}
          </button>
          <Popover anchor={statusAnchor} onClose={() => setStatusAnchor(null)} width={220} align="start">
            <div className="mb-1.5 flex gap-1.5">
              <button onClick={() => saveHidden(new Set(inactiveIds))} className={`${btnOutline} flex-1 justify-center px-2 py-1 ${activeOnly ? "border-accent text-accent" : ""}`}>
                Active only
              </button>
              <button onClick={() => saveHidden(new Set())} className={`${btnOutline} flex-1 justify-center px-2 py-1`}>
                Show all
              </button>
            </div>
            {statuses.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hover">
                <input
                  type="checkbox"
                  checked={!hidden.has(s.id)}
                  onChange={() => saveHidden(toggle(hidden, s.id))}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
                {s.name}
              </label>
            ))}
          </Popover>
          <button onClick={() => showView("board")} className={`${btnGhost} ${kanban ? "!bg-accent !text-accent-fg" : ""}`}>
            <IconColumns />
            Board
          </button>
          <button onClick={() => showView("calendar")} className={`${btnGhost} ${calendar ? "!bg-accent !text-accent-fg" : ""}`}>
            <IconCalendar />
            Calendar
          </button>
          {filtering && (
            <button onClick={() => { setQuery(""); setPerson(null); setStage(null); }} className={`${btnGhost} text-muted`}>
              <IconX /> Clear
            </button>
          )}
          <div className="flex-1" />
          {memberIds && (
            <ProjectPeople
              boardId={board.id}
              boardName={board.name}
              people={people}
              memberIds={memberIds}
              allProfiles={profiles}
              onChanged={loadMembers}
            />
          )}
          {view === "table" && (
            <button
              onClick={() => setExpanded(expanded.size ? new Set() : new Set(top.map((t) => t.id)))}
              className={`${btnGhost} text-muted`}
            >
              {expanded.size ? "Collapse subitems" : "Expand subitems"}
            </button>
          )}
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-x-auto px-4 pb-24 pt-5 md:px-6">
        {!loaded ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : kanban ? (
          <BoardKanban
            tasks={tasks
              .filter((k) => {
                const parent = k.parent_id ? tasks.find((p) => p.id === k.parent_id) : undefined;
                return !!parent && (!filtering || matches(k) || matches(parent));
              })
              .sort(byPosition)}
            allTasks={tasks}
            statuses={statuses}
            stages={stages}
            onOpen={(id) => openTask(id)}
            onMove={(id, status_id) => update(id, { status_id })}
          />
        ) : calendar ? (
          <BoardCalendar
            tasks={tasks.filter((t) => (!filtering || matches(t)) && !hidden.has(t.status_id ?? NO_STATUS))}
            statuses={statuses}
            stages={stages}
            onOpen={(id) => openTask(id)}
          />
        ) : (
          <div className="min-w-[1330px] space-y-5">
            {groups.map((g) => {
              const isCollapsed = collapsed.has(g.key);
              return (
                <section key={g.key} className="rounded-3xl bg-panel/90 p-4 shadow-card backdrop-blur">
                  <div className={`flex items-center gap-2 ${isCollapsed || !g.tasks.length ? "" : "mb-3"}`}>
                    <button
                      onClick={() => setCollapsed((c) => toggle(c, g.key))}
                      className="flex items-center gap-2 px-1 text-lg font-medium"
                    >
                      <IconChevron className={`h-4 w-4 text-muted transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
                      {g.name}
                      <span className="rounded-full bg-panel-2 px-2 py-0.5 text-xs font-normal text-muted">
                        {g.tasks.length} {g.tasks.length === 1 ? "task" : "tasks"}
                      </span>
                    </button>
                    <button
                      onClick={() => addInGroup(g.key)}
                      title={`Add a task to ${g.name}`}
                      aria-label={`Add a task to ${g.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-panel-2 text-muted transition hover:bg-accent hover:text-accent-fg"
                    >
                      <IconPlus />
                    </button>
                  </div>
                  {!isCollapsed && g.tasks.length > 0 && (
                    <div
                      className="ml-7 rounded-2xl border border-line [&>*:first-child]:rounded-t-2xl [&>*:last-child]:rounded-b-2xl [&>*:last-child]:border-b-0"
                    >
                      <HeaderRow
                        first="Task"
                        allSelected={g.tasks.length > 0 && g.tasks.every((t) => selected.has(t.id))}
                        onSelectAll={
                          g.tasks.length
                            ? () => select(g.tasks.map((t) => t.id), !g.tasks.every((t) => selected.has(t.id)))
                            : undefined
                        }
                      />
                      {g.tasks.map((t) => {
                        const kids = childrenOf(t.id);
                        const open = expanded.has(t.id) || (filtering && kids.some(matches));
                        return (
                          <Fragment key={t.id}>
                            <TaskRow
                              task={t}
                              childCount={kids.length}
                              stageLocked={kids.length > 0}
                              expanded={open}
                              commentCount={counts[t.id] ?? 0}
                              autoEdit={fresh === t.id}
                              selected={selected.has(t.id)}
                              onSelect={() => select([t.id], !selected.has(t.id))}
                              onToggle={() => setExpanded((e) => toggle(e, t.id))}
                              onOpen={() => openTask(t.id)}
                              onOpenApproval={() => openTask(t.id, "approval")}
                              onUpdate={(patch) => update(t.id, patch)}
                              onDelete={() => remove(t.id)}
                              onAddSub={() => setExpanded((e) => new Set(e).add(t.id))}
                            />
                            {open && (
                              <div className="border-l-4 border-l-accent/40">
                                <HeaderRow first="Subitem (stage)" sub />
                                {kids.map((k) => (
                                  <TaskRow
                                    key={k.id}
                                    task={k}
                                    sub
                                    commentCount={counts[k.id] ?? 0}
                                    autoEdit={fresh === k.id}
                                    selected={selected.has(k.id)}
                                    onSelect={() => select([k.id], !selected.has(k.id))}
                                    onOpen={() => openTask(k.id)}
                                    onOpenApproval={() => openTask(k.id, "approval")}
                                    onUpdate={(patch) => update(k.id, patch)}
                                    onDelete={() => remove(k.id)}
                                  />
                                ))}
                                <AddStageRow used={kids.map((k) => k.stage_id ?? "")} onAdd={(stage) => addSub(t, stage)} />
                              </div>
                            )}
                          </Fragment>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
            {filtering && !visibleTop.length && (
              <p className="py-10 text-center text-sm text-muted">No tasks match these filters.</p>
            )}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-panel py-2 pl-5 pr-2 shadow-card">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          {confirmingDelete ? (
            <>
              <span className="text-sm text-muted">Delete for everyone?</span>
              <button onClick={removeSelected} className={`${btnPrimary} !bg-red-600`}>
                <IconTrash /> Yes, delete
              </button>
              <button onClick={() => setConfirmingDelete(false)} className={btnOutline}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmingDelete(true)} className={`${btnOutline} text-red-500`}>
                <IconTrash /> Delete
              </button>
              <button onClick={() => select([...selected], false)} className="rounded p-1.5 text-muted hover:bg-hover hover:text-fg" title="Clear selection">
                <IconX />
              </button>
            </>
          )}
        </div>
      )}

      {openTaskObj && (
        <TaskPanel
          key={`${openTaskObj.id}-${openView}`}
          task={openTaskObj}
          parent={openTaskObj.parent_id ? tasks.find((t) => t.id === openTaskObj.parent_id) : undefined}
          view={openView}
          onClose={() => openTask(null)}
          onUpdate={(patch) => update(openTaskObj.id, patch)}
          onPatchLocal={(patch) => patchLocal(openTaskObj.id, patch)}
        />
      )}

      {newTaskIn && (
        <NewTaskDialog
          groupName={statuses.find((s) => s.id === newTaskIn)?.name ?? "No status"}
          onCreate={(fields) => createFromDialog(newTaskIn, fields)}
          onClose={() => setNewTaskIn(null)}
        />
      )}
    </div>
    </BoardScope>
  );
}
