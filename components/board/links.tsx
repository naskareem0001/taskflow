"use client";

import type { Task, TaskLink } from "@/lib/types";
import { IconPlus, IconX } from "../icons";

export const MAX_LINKS = 3;

/** Turns what someone typed into a safe web address, or null if it isn't one. */
export function cleanUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Short site name for a link, e.g. "milanote.com". */
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^(www|app)\./, "");
  } catch {
    return "Open";
  }
}

export const linkName = (l: TaskLink) => l.label.trim() || hostOf(l.url);

/** A task's links. Falls back to the older single `link` field. */
export function linksOf(task: Task): TaskLink[] {
  if (Array.isArray(task.links)) return task.links;
  return task.link ? [{ label: "", url: task.link }] : [];
}

/** Drops empty rows and tidies addresses. `bad` is the first row that isn't a web link. */
export function cleanLinks(drafts: TaskLink[]): { links: TaskLink[]; bad: number | null } {
  const links: TaskLink[] = [];
  for (let i = 0; i < drafts.length; i++) {
    if (!drafts[i].url.trim()) continue;
    const url = cleanUrl(drafts[i].url);
    if (!url) return { links, bad: i };
    links.push({ label: drafts[i].label.trim(), url });
  }
  return { links: links.slice(0, MAX_LINKS), bad: null };
}

/** Editable list of up to three links, each with an optional button label. */
export function LinksEditor({
  value,
  onChange,
  bad,
}: {
  value: TaskLink[];
  onChange: (links: TaskLink[]) => void;
  bad?: number | null;
}) {
  const set = (i: number, patch: Partial<TaskLink>) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const input = "rounded-xl border bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent";
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i}>
          <div className="flex items-center gap-2">
            <input
              value={l.label}
              onChange={(e) => set(i, { label: e.target.value })}
              placeholder="Button name"
              maxLength={24}
              className={`${input} w-32 shrink-0 border-line`}
            />
            <input
              value={l.url}
              onChange={(e) => set(i, { url: e.target.value })}
              placeholder="Paste a link"
              className={`${input} min-w-0 flex-1 ${bad === i ? "border-red-500" : "border-line"}`}
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="shrink-0 rounded-full p-1.5 text-muted hover:bg-hover hover:text-red-500"
              title="Remove this link"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
          {bad === i && <p className="mt-1 text-xs text-red-500">That doesn&apos;t look like a web link.</p>}
        </div>
      ))}
      {value.length < MAX_LINKS && (
        <button
          type="button"
          onClick={() => onChange([...value, { label: "", url: "" }])}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-sm text-accent hover:bg-hover"
        >
          <IconPlus className="h-3.5 w-3.5" /> Add {value.length ? "another link" : "a link"}
        </button>
      )}
    </div>
  );
}
