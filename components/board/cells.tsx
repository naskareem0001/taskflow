"use client";

import { useRef, useState } from "react";
import { formatDate, todayISO } from "@/lib/format";
import type { ApprovalState, Option } from "@/lib/types";
import { useWorkspace } from "../workspace";
import { Avatar, Popover } from "../ui";
import { IconCheck, IconChevron, IconEdit, IconLink, IconPerson, IconX } from "../icons";

/** Colored status/stage cell with a dropdown of options (Monday-style). */
export function OptionCell({
  value,
  options,
  onChange,
  emptyLabel = "",
}: {
  value: string | null;
  options: Option[];
  onChange: (id: string | null) => void;
  emptyLabel?: string;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = options.find((o) => o.id === value);
  const pick = (id: string | null) => {
    setAnchor(null);
    if (id !== value) onChange(id);
  };
  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className="mx-1.5 h-7 min-w-0 flex-1 truncate rounded-full px-3 text-[13px] font-medium text-white transition hover:brightness-110"
        style={{ background: current ? current.color : "var(--empty)" }}
      >
        {current?.name ?? emptyLabel}
      </button>
      <Popover anchor={anchor} onClose={() => setAnchor(null)} width={200}>
        <div className="flex flex-col gap-1.5">
          {options.map((o) => (
            <button
              key={o.id}
              onClick={() => pick(o.id)}
              className="relative rounded-full px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
              style={{ background: o.color }}
            >
              {o.name}
              {o.id === value && <IconCheck className="absolute right-2 top-2 h-4 w-4" />}
            </button>
          ))}
          {value && (
            <button onClick={() => pick(null)} className="rounded py-1 text-sm text-muted hover:bg-hover">
              Clear
            </button>
          )}
        </div>
      </Popover>
    </>
  );
}

export function PersonCell({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { profiles, byId, me } = useWorkspace();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [q, setQ] = useState("");
  const person = value ? byId.get(value) : undefined;
  const list = profiles.filter(
    (p) => !q || p.full_name.toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().includes(q.toLowerCase()),
  );
  const pick = (id: string | null) => {
    setAnchor(null);
    setQ("");
    if (id !== value) onChange(id);
  };
  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className="flex h-full w-full items-center justify-center hover:bg-hover/60"
        title={person ? person.full_name : "Assign"}
      >
        {person ? <Avatar profile={person} size={28} /> : <IconPerson className="h-7 w-7 text-muted" />}
      </button>
      <Popover anchor={anchor} onClose={() => setAnchor(null)} width={250}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search names"
          className="mb-1.5 w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
        <div className="max-h-64 overflow-y-auto">
          {list.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-hover ${p.id === value ? "bg-hover" : ""}`}
            >
              <Avatar profile={p} size={24} />
              <span className="truncate">{p.full_name}</span>
              {p.id === me.id && <span className="text-xs text-muted">(you)</span>}
            </button>
          ))}
          {!list.length && <p className="px-2 py-2 text-sm text-muted">No match</p>}
        </div>
        {value && (
          <button onClick={() => pick(null)} className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted hover:bg-hover">
            <IconX /> Remove
          </button>
        )}
      </Popover>
    </>
  );
}

export function DateCell({
  value,
  onChange,
  done,
}: {
  value: string | null;
  onChange: (d: string | null) => void;
  done: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const overdue = !!value && !done && value < todayISO();
  const pick = (d: string | null) => {
    setAnchor(null);
    if (d !== value) onChange(d);
  };
  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className={`group/date flex h-full w-full items-center justify-center gap-1 text-sm hover:bg-hover/60 ${
          overdue ? "font-medium text-red-500" : ""
        }`}
        title={overdue ? "Overdue" : undefined}
      >
        {value ? (
          <>
            {done && <IconCheck className="h-3.5 w-3.5 text-emerald-500" />}
            <span className={done ? "text-muted line-through" : ""}>{formatDate(value)}</span>
          </>
        ) : (
          <span className="text-muted opacity-0 group-hover/date:opacity-100">+ date</span>
        )}
      </button>
      <Popover anchor={anchor} onClose={() => setAnchor(null)} width={288}>
        <Calendar value={value} onPick={pick} />
      </Popover>
    </>
  );
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Month grid date picker, styled to match the rest of the app. */
function Calendar({ value, onPick }: { value: string | null; onPick: (d: string | null) => void }) {
  const today = todayISO();
  const [startYear, startMonth] = (value ?? today).split("-").map(Number);
  const [view, setView] = useState({ year: startYear, month: startMonth - 1 });

  const shift = (by: number) => {
    const d = new Date(view.year, view.month + by, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Always six rows, starting on the Sunday on or before the 1st.
  const first = new Date(view.year, view.month, 1);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(view.year, view.month, 1 - first.getDay() + i);
    return { key: iso(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === view.month };
  });

  const nav = "flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg";

  return (
    <div className="p-1.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="pl-1.5 font-medium">
          {first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <div className="flex gap-1">
          <button type="button" onClick={() => shift(-1)} className={nav} aria-label="Previous month">
            <IconChevron className="h-4 w-4 rotate-180" />
          </button>
          <button type="button" onClick={() => shift(1)} className={nav} aria-label="Next month">
            <IconChevron className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1.5">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const selected = d.key === value;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onPick(d.key)}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                selected
                  ? "bg-accent font-medium text-accent-fg shadow-sm"
                  : `hover:bg-hover ${d.inMonth ? "" : "text-muted/50"} ${d.key === today ? "font-semibold text-accent ring-1 ring-accent/50" : ""}`
              }`}
            >
              {d.day}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <button type="button" onClick={() => onPick(null)} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hover hover:text-fg">
          Clear
        </button>
        <button type="button" onClick={() => onPick(today)} className="rounded-full px-3 py-1.5 text-sm font-medium text-accent hover:bg-hover">
          Today
        </button>
      </div>
    </div>
  );
}

const APPROVAL: Record<ApprovalState, { label: string; className: string }> = {
  none: { label: "—", className: "text-muted" },
  pending: { label: "Awaiting review", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  changes: { label: "Changes requested", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

export function ApprovalBadge({ state }: { state: ApprovalState }) {
  const a = APPROVAL[state];
  return <span className={`inline-block truncate rounded-full px-2 py-0.5 text-xs font-medium ${a.className}`}>{a.label}</span>;
}

export function ApprovalCell({ state, onOpen }: { state: ApprovalState; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full items-center justify-center px-1 hover:bg-hover/60"
      title="Open approval"
    >
      <ApprovalBadge state={state} />
    </button>
  );
}

/** Turns what someone typed into a safe web address, or null if it isn't one. */
function cleanUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** A reference link (Milanote, Figma, Drive…). Shows the site name; opens in a new tab. */
export function LinkCell({ value, onChange }: { value: string | null; onChange: (link: string | null) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState("");
  const [bad, setBad] = useState(false);

  let host = "";
  try {
    if (value) host = new URL(value).hostname.replace(/^(www|app)\./, "");
  } catch {}

  const edit = () => {
    setDraft(value ?? "");
    setBad(false);
    setAnchor(anchor ? null : wrap.current);
  };

  const save = () => {
    if (!draft.trim()) {
      setAnchor(null);
      if (value) onChange(null);
      return;
    }
    const url = cleanUrl(draft);
    if (!url) return setBad(true);
    setAnchor(null);
    if (url !== value) onChange(url);
  };

  return (
    <div ref={wrap} className="group/link flex h-full w-full items-center justify-center gap-0.5 px-1.5">
      {value ? (
        <>
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            title={value}
            className="flex min-w-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/25"
          >
            <IconLink className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{host || "Open"}</span>
          </a>
          <button
            type="button"
            onClick={edit}
            className="shrink-0 rounded-full p-1 text-muted opacity-0 hover:bg-hover hover:text-fg focus:opacity-100 group-hover/link:opacity-100"
            title="Edit link"
          >
            <IconEdit className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={edit}
          className="h-full w-full text-sm text-muted opacity-0 hover:bg-hover/60 focus:opacity-100 group-hover/link:opacity-100"
        >
          + link
        </button>
      )}
      <Popover anchor={anchor} onClose={() => setAnchor(null)} width={320}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="p-1"
        >
          <label className="mb-1 block text-xs font-medium text-muted">Link (Milanote, Figma, Drive…)</label>
          <input
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setBad(false);
            }}
            placeholder="https://app.milanote.com/…"
            className={`w-full rounded-xl border bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent ${bad ? "border-red-500" : "border-line"}`}
          />
          {bad && <p className="mt-1 text-xs text-red-500">That doesn&apos;t look like a web link.</p>}
          <div className="mt-2 flex items-center justify-between">
            {value ? (
              <button
                type="button"
                onClick={() => {
                  setAnchor(null);
                  onChange(null);
                }}
                className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-hover hover:text-red-500"
              >
                Remove
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg hover:brightness-110">
              Save
            </button>
          </div>
        </form>
      </Popover>
    </div>
  );
}
