"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { TaskLink } from "@/lib/types";
import { btnGhost, btnPrimary, field } from "../ui";
import { IconX } from "../icons";
import { LinksEditor, cleanLinks } from "./links";

export type NewTask = { title: string; brief: string; links: TaskLink[] };

/** Opened by "New task" and the "+" beside a group: name, short brief, and up to three links. */
export function NewTaskDialog({
  groupName,
  onCreate,
  onClose,
}: {
  groupName: string;
  onCreate: (task: NewTask) => Promise<boolean>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [bad, setBad] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const cleaned = cleanLinks(links);
    if (cleaned.bad !== null) return setBad(cleaned.bad);
    setBusy(true);
    const ok = await onCreate({ title: title.trim(), brief: brief.trim(), links: cleaned.links });
    setBusy(false);
    if (ok) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
        className="flex max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-3xl border border-line bg-panel p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">New task</h2>
            <p className="text-xs text-muted">Goes into {groupName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-hover hover:text-fg" aria-label="Close">
            <IconX />
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Task name
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Launch video cut-downs" className={field} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Brief <span className="-mt-1 text-xs text-muted">Optional. What needs doing, and anything the team should know.</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            placeholder="Three cut-downs of the launch film: 6s, 20s and 45s…"
            className={`${field} resize-y`}
          />
        </label>

        <div className="flex flex-col gap-1.5 text-sm">
          Links <span className="-mt-1 text-xs text-muted">Optional, up to three. Milanote, Figma, Drive, a reference video…</span>
          <LinksEditor
            value={links}
            bad={bad}
            onChange={(v) => {
              setLinks(v);
              setBad(null);
            }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={busy || !title.trim()} className={btnPrimary}>
            {busy ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
