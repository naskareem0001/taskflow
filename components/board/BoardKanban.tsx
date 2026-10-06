"use client";

import { useState } from "react";
import type { Option, Task } from "@/lib/types";
import { formatDate, isDoneName, todayISO } from "@/lib/format";
import { useWorkspace } from "../workspace";
import { Avatar } from "../ui";

// The board keeps to the three working columns; other statuses stay in the table view.
const COLUMNS = ["todo", "doing", "done"];
const key = (s: Option) => s.name.trim().toLowerCase().replace(/\s+/g, "");

/**
 * Board view of a project: To do, Doing and Done as columns of subitem cards (one per stage of
 * each task). Drag a card to another column to change its status; click it to open its chat.
 */
export function BoardKanban({
  tasks,
  allTasks,
  statuses,
  stages,
  onOpen,
  onMove,
}: {
  /** Subitems that pass the board's filters. */
  tasks: Task[];
  /** Every task on the project, to name each card's parent task. */
  allTasks: Task[];
  statuses: Option[];
  stages: Option[];
  onOpen: (id: string) => void;
  onMove: (id: string, statusId: string) => void;
}) {
  const { byId } = useWorkspace();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const today = todayISO();

  const named = COLUMNS.map((c) => statuses.find((s) => key(s) === c)).filter((s): s is Option => !!s);
  const columns = named.length >= 2 ? named : statuses;

  return (
    <div className="grid min-w-[720px] gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
      {columns.map((col) => {
        const cards = tasks.filter((t) => t.status_id === col.id);
        const done = isDoneName(col.name);
        return (
          <section
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragging;
              setOver(null);
              setDragging(null);
              if (id && tasks.find((t) => t.id === id)?.status_id !== col.id) onMove(id, col.id);
            }}
            className={`flex flex-col rounded-3xl bg-panel/90 p-3 shadow-card backdrop-blur transition ${
              over === col.id && dragging ? "ring-2 ring-accent" : ""
            }`}
          >
            <div className="mb-3 flex items-center gap-2 px-1.5 pt-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
              <h2 className="text-lg font-medium">{col.name}</h2>
              <span className="rounded-full bg-panel-2 px-2 py-0.5 text-xs text-muted">{cards.length}</span>
            </div>
            <div className="flex min-h-[120px] flex-1 flex-col gap-2.5">
              {cards.map((t) => {
                const stage = stages.find((s) => s.id === t.stage_id);
                const parent = allTasks.find((p) => p.id === t.parent_id);
                const owner = t.owner_id ? byId.get(t.owner_id) : undefined;
                const overdue = !!t.due_date && !done && t.due_date < today;
                return (
                  <button
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(t.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onClick={() => onOpen(t.id)}
                    className={`cursor-grab rounded-2xl border border-line bg-panel p-3 text-left shadow-sm transition hover:border-accent/60 hover:shadow-card active:cursor-grabbing ${
                      dragging === t.id ? "opacity-40" : ""
                    }`}
                    style={{ boxShadow: `inset 4px 0 0 ${stage?.color ?? col.color}` }}
                  >
                    <span
                      className="inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ background: stage?.color ?? "#797e93" }}
                    >
                      {stage?.name ?? (t.title || "Untitled")}
                    </span>
                    <p className="mt-1.5 break-words text-sm font-medium leading-5">{parent?.title || "Untitled"}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <div className="flex-1" />
                      {(t.start_date || t.due_date) && (
                        <span className="whitespace-nowrap">
                          {t.start_date && formatDate(t.start_date)}
                          {t.start_date && t.due_date && " – "}
                          {t.due_date && (
                            <span className={overdue ? "font-medium text-red-500" : done ? "line-through" : ""}>
                              {formatDate(t.due_date)}
                            </span>
                          )}
                        </span>
                      )}
                      {owner && <Avatar profile={owner} size={22} />}
                    </div>
                  </button>
                );
              })}
              {!cards.length && (
                <p className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
                  {dragging ? "Drop here" : "No subitems here"}
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
