"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { firstName, timeAgo } from "@/lib/format";
import type { ApprovalAction, ApprovalEvent, ApprovalState, Comment, Profile, Task } from "@/lib/types";
import { useWorkspace } from "../workspace";
import { Avatar, btnOutline, btnPrimary } from "../ui";
import { IconReply, IconTrash, IconX } from "../icons";
import { ApprovalBadge } from "./cells";
import { confirmDialog, notify } from "../dialogs";

type Change = RealtimePostgresChangesPayload<Record<string, unknown>>;

export type PanelView = "chat" | "approval";

/**
 * Side panel for one task or subitem. The chat icon opens it as a plain chat;
 * the Approval cell opens it showing only the approval flow. Everything else
 * about the task is edited in the table.
 */
export function TaskPanel({
  task,
  parent,
  view,
  onClose,
  onPatchLocal,
}: {
  task: Task;
  parent?: Task;
  view: PanelView;
  onClose: () => void;
  onPatchLocal: (patch: Partial<Task>) => void;
}) {
  const { allStages } = useWorkspace();
  const [comments, setComments] = useState<Comment[]>([]);
  const [events, setEvents] = useState<ApprovalEvent[]>([]);

  useEffect(() => {
    const sb = supabase();
    let alive = true;
    (async () => {
      const [c, a] = await Promise.all([
        sb.from("comments").select("*").eq("task_id", task.id).order("created_at"),
        sb.from("approvals").select("*").eq("task_id", task.id).order("created_at"),
      ]);
      if (!alive) return;
      setComments((c.data ?? []) as Comment[]);
      setEvents((a.data ?? []) as ApprovalEvent[]);
    })();
    const filter = `task_id=eq.${task.id}`;
    const channel = sb
      .channel(`task-${task.id}-${Math.random()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments", filter }, (p: Change) => {
        const c = p.new as Comment;
        setComments((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, c]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "comments" }, (p: Change) => {
        const id = (p.old as { id?: string }).id;
        setComments((cs) => cs.filter((x) => x.id !== id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "approvals", filter }, (p: Change) => {
        const e = p.new as ApprovalEvent;
        setEvents((es) => (es.some((x) => x.id === e.id) ? es : [...es, e]));
      })
      .subscribe();
    return () => {
      alive = false;
      sb.removeChannel(channel);
    };
  }, [task.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("[data-popover]")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const name = parent ? (allStages.find((s) => s.id === task.stage_id)?.name ?? task.title) : task.title;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-line bg-panel shadow-2xl md:inset-y-3 md:right-3 md:rounded-3xl md:border">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{view === "chat" ? "Chat" : "Approval"}</p>
            <h2 className="truncate font-semibold">
              {parent && <span className="font-normal text-muted">{parent.title} · </span>}
              {name}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-hover hover:text-fg" title="Close (Esc)">
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {view === "approval" ? (
            <ApprovalCard task={task} events={events} onPatchLocal={onPatchLocal} />
          ) : (
            <Updates taskId={task.id} comments={comments} />
          )}
        </div>
      </aside>
    </>
  );
}

const EVENT_TEXT: Record<ApprovalAction, string> = {
  requested: "requested approval",
  approved: "approved",
  changes: "requested changes",
};

const NEXT_STATE: Record<ApprovalAction, ApprovalState> = {
  requested: "pending",
  approved: "approved",
  changes: "changes",
};

function ApprovalCard({
  task,
  events,
  onPatchLocal,
}: {
  task: Task;
  events: ApprovalEvent[];
  onPatchLocal: (patch: Partial<Task>) => void;
}) {
  const { me, isAdmin, byId } = useWorkspace();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const requestor = task.requestor_id ? byId.get(task.requestor_id) : undefined;
  const canDecide = task.approval === "pending" && (task.requestor_id === me.id || isAdmin);

  const act = async (action: ApprovalAction) => {
    setBusy(true);
    const { error } = await supabase().from("approvals").insert({ task_id: task.id, action, note: note.trim() });
    setBusy(false);
    if (error) return notify(error.message);
    setNote("");
    onPatchLocal({ approval: NEXT_STATE[action] });
  };

  const noteBox = (placeholder: string) => (
    <textarea
      value={note}
      onChange={(e) => setNote(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full resize-y rounded-md border border-line bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
    />
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Status</h3>
        <ApprovalBadge state={task.approval} />
      </div>

      {task.approval === "pending" ? (
        canDecide ? (
          <div className="space-y-2">
            {noteBox("Feedback for the owner (optional)")}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => act("approved")} className={`${btnPrimary} !bg-emerald-600`}>Approve</button>
              <button disabled={busy} onClick={() => act("changes")} className={`${btnOutline} text-red-500`}>Request changes</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Waiting for {requestor ? firstName(requestor.full_name) : "the requestor"} to review.</p>
        )
      ) : (
        <div className="space-y-2">
          {noteBox("Link to the cut, frame, or file + what to review (optional)")}
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={busy || !requestor} onClick={() => act("requested")} className={btnPrimary}>
              {task.approval === "none" ? "Request approval" : "Request re-approval"}
              {requestor ? ` from ${firstName(requestor.full_name)}` : ""}
            </button>
            {!requestor && <span className="text-xs text-muted">Set a requestor first.</span>}
          </div>
        </div>
      )}

      {events.length > 0 && (
        <ol className="mt-4 space-y-3 border-t border-line pt-3">
          {[...events].reverse().map((e) => {
            const actor = e.actor_id ? byId.get(e.actor_id) : undefined;
            return (
              <li key={e.id} className="flex gap-2 text-sm">
                <Avatar profile={actor} size={22} />
                <div className="min-w-0">
                  <span className="font-medium">{actor?.full_name ?? "Someone"}</span> {EVENT_TEXT[e.action]}
                  <span className="ml-1 text-xs text-muted">{timeAgo(e.created_at)}</span>
                  {e.note && <p className="mt-0.5 whitespace-pre-wrap break-words text-muted"><RichText text={e.note} /></p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Updates({ taskId, comments }: { taskId: string; comments: Comment[] }) {
  const { me, isAdmin, byId } = useWorkspace();
  // The update whose inline reply box is open.
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const remove = async (id: string) => {
    if (!(await confirmDialog("Delete this message?"))) return;
    const { error } = await supabase().from("comments").delete().eq("id", id);
    if (error) notify(error.message);
  };

  // Threads are one level deep: a reply to a reply joins the same thread.
  const map = new Map(comments.map((c) => [c.id, c]));
  const rootOf = (c: Comment) => {
    let cur = c;
    for (let i = 0; i < 50 && cur.reply_to && map.has(cur.reply_to); i++) cur = map.get(cur.reply_to)!;
    return cur.id;
  };
  const roots = comments.filter((c) => rootOf(c) === c.id).reverse();
  const repliesOf = (rootId: string) => comments.filter((c) => c.id !== rootId && rootOf(c) === rootId);

  const card = (c: Comment, isReply: boolean) => {
    const author = c.author_id ? byId.get(c.author_id) : undefined;
    return (
      <div key={c.id}>
        <div className={`group rounded-2xl border border-line p-3 ${isReply ? "bg-panel" : "bg-panel-2"}`}>
          <div className="mb-1.5 flex items-center gap-2">
            <Avatar profile={author} size={isReply ? 22 : 26} />
            <span className="text-sm font-medium">{author?.full_name ?? "Former member"}</span>
            <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>
            <button
              onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
              className={`ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium hover:bg-hover hover:text-fg ${
                replyTo === c.id ? "bg-hover text-fg" : "text-muted"
              }`}
            >
              <IconReply className="h-3.5 w-3.5" /> Reply
            </button>
            {(c.author_id === me.id || isAdmin) && (
              <button onClick={() => remove(c.id)} className="rounded p-1 text-muted opacity-0 hover:text-red-500 group-hover:opacity-100" title="Delete">
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-6">
            <RichText text={c.body} />
          </p>
        </div>
        {replyTo === c.id && (
          <div className={`mt-2 ${isReply ? "" : "ml-5 border-l-2 border-accent/40 pl-3"}`}>
            <Composer
              taskId={taskId}
              replyTo={c}
              replyName={author?.full_name ?? "this update"}
              onDone={() => setReplyTo(null)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <section>
      <Composer taskId={taskId} />
      <ul className="mt-4 space-y-4">
        {roots.map((root) => {
          const replies = repliesOf(root.id);
          return (
            <li key={root.id}>
              {card(root, false)}
              {replies.length > 0 && (
                <div className="ml-5 mt-2 space-y-2 border-l-2 border-accent/40 pl-3">
                  {replies.map((r) => card(r, true))}
                </div>
              )}
            </li>
          );
        })}
        {!comments.length && <li className="py-4 text-center text-sm text-muted">No messages yet. Start the conversation.</li>}
      </ul>
    </section>
  );
}

function Composer({
  taskId,
  replyTo,
  replyName,
  onDone,
}: {
  taskId: string;
  /** Set when this is the inline reply box under an update. */
  replyTo?: Comment;
  replyName?: string;
  onDone?: () => void;
}) {
  const { profiles, me } = useWorkspace();
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [mention, setMention] = useState<string | null>(null);
  const [hi, setHi] = useState(0);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTo) ref.current?.focus();
  }, [replyTo]);

  const suggestions =
    mention === null
      ? []
      : profiles
          .filter((p) => p.id !== me.id && (p.full_name.toLowerCase().includes(mention) || p.email.toLowerCase().startsWith(mention)))
          .slice(0, 6);

  const detect = (value: string, caret: number) => {
    const m = /(^|\s)@([^\s@]*)$/.exec(value.slice(0, caret));
    setMention(m ? m[2].toLowerCase() : null);
    setHi(0);
  };

  const choose = (p: Profile) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = body.slice(0, caret).replace(/@([^\s@]*)$/, `@${p.full_name} `);
    setBody(before + body.slice(caret));
    setPicked((xs) => (xs.includes(p.id) ? xs : [...xs, p.id]));
    setMention(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const send = async () => {
    const text = body.trim();
    if (!text || busy) return;
    const mentions = picked.filter((id) => {
      const p = profiles.find((x) => x.id === id);
      return p && text.includes(`@${p.full_name}`);
    });
    // Replying tags the original update and notifies its author.
    const reply: { reply_to?: string } = {};
    if (replyTo) {
      reply.reply_to = replyTo.id;
      if (replyTo.author_id && replyTo.author_id !== me.id && !mentions.includes(replyTo.author_id)) mentions.push(replyTo.author_id);
    }
    setBusy(true);
    const { error } = await supabase().from("comments").insert({ task_id: taskId, body: text, mentions, ...reply });
    setBusy(false);
    if (error) {
      return notify(
        /reply_to/.test(error.message)
          ? "Replies need a one-time database update. In Supabase → SQL Editor, run:\n\nalter table public.comments add column if not exists reply_to uuid references public.comments(id) on delete set null;"
          : error.message,
      );
    }
    setBody("");
    setPicked([]);
    onDone?.();
  };

  return (
    <div className="relative rounded-2xl border border-line focus-within:border-accent">
      <textarea
        ref={ref}
        value={body}
        rows={replyTo ? 2 : 3}
        placeholder={replyTo ? `Reply to ${replyName}…` : "Write a message… type @ to mention someone"}
        onChange={(e) => {
          setBody(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (suggestions.length) {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % suggestions.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h - 1 + suggestions.length) % suggestions.length); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(suggestions[hi]); return; }
            if (e.key === "Escape") { e.stopPropagation(); setMention(null); return; }
          }
          if (e.key === "Escape" && replyTo) {
            e.stopPropagation();
            onDone?.();
            return;
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        onBlur={() => setTimeout(() => setMention(null), 150)}
        className="block w-full resize-y rounded-t-2xl bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-muted"
      />
      {suggestions.length > 0 && (
        <div className="absolute left-2 right-2 top-full z-10 mt-1 rounded-lg border border-line bg-panel p-1 shadow-xl">
          {suggestions.map((p, i) => (
            <button
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); choose(p); }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${i === hi ? "bg-hover" : ""}`}
            >
              <Avatar profile={p} size={22} /> {p.full_name}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-line px-3 py-2">
        <span className="text-xs text-muted">Ctrl + Enter to post</span>
        <div className="flex items-center gap-2">
          {replyTo && (
            <button onClick={onDone} className="rounded-full px-3 py-2 text-sm text-muted hover:bg-hover hover:text-fg">
              Cancel
            </button>
          )}
          <button onClick={send} disabled={!body.trim() || busy} className={btnPrimary}>{replyTo ? "Reply" : "Send"}</button>
        </div>
      </div>
    </div>
  );
}

/** Highlights @mentions of team members and makes links clickable. */
function RichText({ text }: { text: string }) {
  const { profiles } = useWorkspace();
  const names = profiles
    .map((p) => p.full_name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(https?://[^\\s]+${names.length ? `|@(?:${names.join("|")})` : ""})`, "g");
  return (
    <>
      {text.split(pattern).map((part, i) => {
        if (i % 2 === 0) return part;
        if (part.startsWith("@")) {
          return <span key={i} className="rounded bg-accent/15 px-0.5 font-medium text-accent">{part}</span>;
        }
        return (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all text-accent underline">
            {part}
          </a>
        );
      })}
    </>
  );
}
