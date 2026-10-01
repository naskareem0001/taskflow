"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/format";
import type { Notif, NotifKind } from "@/lib/types";
import { useWorkspace } from "./workspace";
import { Avatar, Popover } from "./ui";
import { IconBell } from "./icons";

const VERB: Record<NotifKind, string> = {
  assigned: "assigned you to",
  mention: "mentioned you on",
  approval_requested: "requested your approval on",
  approval_approved: "approved",
  approval_changes: "requested changes on",
};

export function NotificationBell() {
  const { me, byId } = useWorkspace();
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase()
      .from("notifications")
      .select("*, task:tasks(id, board_id, title)")
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(40);
    setItems((data ?? []) as Notif[]);
  }, [me.id]);

  useEffect(() => {
    load();
    const sb = supabase();
    const channel = sb
      .channel(`notifications-${Math.random()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` }, load)
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [load, me.id]);

  const unread = items.filter((n) => !n.read).length;

  const open = async (n: Notif) => {
    setAnchor(null);
    if (!n.read) {
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      await supabase().from("notifications").update({ read: true }).eq("id", n.id);
    }
    // Approval notifications open the approval view; everything else opens the chat.
    if (n.task) router.push(`/board/${n.task.board_id}?task=${n.task.id}${n.kind.startsWith("approval") ? "&view=approval" : ""}`);
  };

  const markAll = async () => {
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    await supabase().from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
  };

  return (
    <>
      <button
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-panel/80 text-muted shadow-sm hover:text-fg"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <IconBell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <Popover anchor={anchor} onClose={() => setAnchor(null)} width={360} align="end">
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          <span className="font-semibold">Notifications</span>
          {unread > 0 && (
            <button onClick={markAll} className="text-xs text-accent hover:underline">
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {!items.length && <p className="px-2 py-6 text-center text-sm text-muted">You&apos;re all caught up.</p>}
          {items.map((n) => {
            const actor = n.actor_id ? byId.get(n.actor_id) : undefined;
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className="flex w-full gap-3 rounded-md px-2 py-2.5 text-left hover:bg-hover"
              >
                {actor ? <Avatar profile={actor} size={32} /> : <span className="h-8 w-8 shrink-0 rounded-full bg-empty" />}
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{actor?.full_name ?? "Someone"}</span> {VERB[n.kind]}{" "}
                  <span className="font-medium">{n.task?.title || "a task"}</span>
                  {n.body && <span className="mt-0.5 block truncate text-muted">“{n.body}”</span>}
                  <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.created_at)}</span>
                </span>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
