"use client";

import { useMemo, useState } from "react";
import type { Option, Task } from "@/lib/types";
import { formatDate, todayISO } from "@/lib/format";
import { IconChevron } from "../icons";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_LANES = 5;
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** A task drawn on the calendar: it blocks out every day from its start date to its due date. */
interface Entry {
  task: Task;
  label: string;
  /** Subitems: their stage colour. Main tasks are drawn in a soft neutral style instead. */
  color: string;
  /** Status colour, shown as a dot on main tasks. */
  dot: string;
  main: boolean;
  start: string;
  end: string;
}

/**
 * Calendar view of a project: each dated task (and subitem) is a bar from its start date to its
 * due date, so the blocked-out days are easy to see. Month view shows the bars; year view shades
 * every busy day.
 */
export function BoardCalendar({
  tasks,
  statuses,
  stages,
  onOpen,
}: {
  /** Tasks and subitems that pass the board's filters. */
  tasks: Task[];
  statuses: Option[];
  stages: Option[];
  onOpen: (id: string) => void;
}) {
  const today = todayISO();
  const [mode, setMode] = useState<"month" | "year">("month");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const entries = useMemo<Entry[]>(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    return tasks
      .filter((t) => t.start_date || t.due_date)
      .map((t) => {
        let start = (t.start_date || t.due_date) as string;
        let end = (t.due_date || t.start_date) as string;
        if (start > end) [start, end] = [end, start];
        const parent = t.parent_id ? byId.get(t.parent_id) : undefined;
        const stage = stages.find((s) => s.id === t.stage_id);
        const label = parent ? `${parent.title || "Untitled"} · ${stage?.name ?? t.title}` : t.title || "Untitled";
        const dot = statuses.find((s) => s.id === t.status_id)?.color ?? "#797e93";
        const color = stage?.color ?? dot;
        return { task: t, label, color, dot, main: !parent, start, end };
      })
      // Main tasks first so they take the top lane, above their subitems.
      .sort((a, b) => Number(b.main) - Number(a.main) || a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  }, [tasks, statuses, stages]);

  const shift = (by: number) =>
    setCursor((c) => {
      if (mode === "year") return { ...c, year: c.year + by };
      const d = new Date(c.year, c.month + by, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const title =
    mode === "year"
      ? String(cursor.year)
      : new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const nav = "flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg";
  const tab = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition ${on ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg"}`;

  return (
    <section className="rounded-3xl bg-panel/90 p-4 shadow-card backdrop-blur md:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="min-w-[10rem] px-1 text-lg font-semibold">{title}</h2>
        <button onClick={() => shift(-1)} className={nav} aria-label="Previous">
          <IconChevron className="h-4 w-4 rotate-180" />
        </button>
        <button onClick={() => shift(1)} className={nav} aria-label="Next">
          <IconChevron className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            const d = new Date();
            setCursor({ year: d.getFullYear(), month: d.getMonth() });
          }}
          className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-hover"
        >
          Today
        </button>
        <div className="flex-1" />
        <div className="flex rounded-full bg-panel-2 p-1">
          <button onClick={() => setMode("month")} className={tab(mode === "month")}>Month</button>
          <button onClick={() => setMode("year")} className={tab(mode === "year")}>Year</button>
        </div>
      </div>

      {mode === "month" ? (
        <MonthGrid year={cursor.year} month={cursor.month} entries={entries} today={today} onOpen={onOpen} />
      ) : (
        <YearGrid
          year={cursor.year}
          entries={entries}
          today={today}
          onPickMonth={(month) => {
            setCursor({ year: cursor.year, month });
            setMode("month");
          }}
        />
      )}

      {!entries.length && (
        <p className="mt-4 text-center text-sm text-muted">
          No dated tasks yet. Add a start or due date to a task to see it here.
        </p>
      )}
    </section>
  );
}

function MonthGrid({
  year,
  month,
  entries,
  today,
  onOpen,
}: {
  year: number;
  month: number;
  entries: Entry[];
  today: string;
  onOpen: (id: string) => void;
}) {
  const first = new Date(year, month, 1);
  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(year, month, 1 - first.getDay() + w * 7 + d);
      return { key: iso(date), day: date.getDate(), inMonth: date.getMonth() === month };
    }),
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] overflow-hidden rounded-2xl border border-line">
        <div className="grid grid-cols-7 border-b border-line bg-panel-2/60">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((days, w) => {
          const weekStart = days[0].key;
          const weekEnd = days[6].key;
          // Bars that touch this week, packed into lanes so they don't overlap.
          const lanes: string[][] = [];
          const placed: { e: Entry; lane: number; from: number; to: number }[] = [];
          for (const e of entries) {
            if (e.end < weekStart || e.start > weekEnd) continue;
            const from = days.findIndex((d) => d.key >= e.start);
            const to = 6 - [...days].reverse().findIndex((d) => d.key <= e.end);
            let lane = lanes.findIndex((l) => !l.slice(from, to + 1).some(Boolean));
            if (lane === -1) {
              lanes.push(Array(7).fill(""));
              lane = lanes.length - 1;
            }
            for (let i = from; i <= to; i++) lanes[lane][i] = e.task.id;
            placed.push({ e, lane, from, to });
          }
          const busy = days.map((_, i) => placed.filter((p) => p.from <= i && p.to >= i).length);
          const hiddenPer = days.map((_, i) => placed.filter((p) => p.lane >= MAX_LANES && p.from <= i && p.to >= i).length);

          return (
            <div key={weekStart} className={`relative ${w < 5 ? "border-b border-line" : ""}`}>
              {/* Day backgrounds: busy days are tinted so blocked-out dates stand out. */}
              <div className="absolute inset-0 grid grid-cols-7">
                {days.map((d, i) => (
                  <div
                    key={d.key}
                    className={`${i < 6 ? "border-r border-line" : ""} ${busy[i] ? "bg-accent/10" : ""} ${d.inMonth ? "" : "bg-panel-2/50"}`}
                  />
                ))}
              </div>
              <div className="relative grid min-h-[112px] grid-cols-7 content-start gap-y-1 pb-2">
                {days.map((d, i) => (
                  <div key={d.key} className="px-2 pt-1.5" style={{ gridColumn: i + 1, gridRow: 1 }}>
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                        d.key === today ? "bg-accent font-semibold text-accent-fg" : d.inMonth ? "font-medium" : "text-muted/60"
                      }`}
                    >
                      {d.day}
                    </span>
                  </div>
                ))}
                {placed
                  .filter((p) => p.lane < MAX_LANES)
                  .map(({ e, lane, from, to }) => {
                    const startsHere = e.start >= weekStart;
                    const endsHere = e.end <= weekEnd;
                    return (
                      <button
                        key={e.task.id}
                        onClick={() => onOpen(e.task.id)}
                        title={`${e.label}\n${e.start === e.end ? formatDate(e.start) : `${formatDate(e.start)} – ${formatDate(e.end)}`}`}
                        className={`mx-1 flex h-6 items-center gap-1.5 truncate px-2 text-left text-xs font-medium hover:brightness-110 ${
                          e.main
                            ? "border border-fg/15 bg-fg/[0.07] text-fg backdrop-blur-sm hover:bg-fg/[0.12]"
                            : "text-white shadow-sm"
                        } ${startsHere ? "rounded-l-full" : "rounded-l-sm"} ${endsHere ? "rounded-r-full" : "rounded-r-sm"}`}
                        style={{
                          gridColumn: `${from + 1} / ${to + 2}`,
                          gridRow: lane + 2,
                          ...(e.main ? {} : { background: e.color }),
                        }}
                      >
                        {e.main && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.dot }} />}
                        <span className="truncate">{e.label}</span>
                      </button>
                    );
                  })}
                {hiddenPer.map((n, i) =>
                  n ? (
                    <span
                      key={`more-${i}`}
                      className="px-2 text-[11px] font-medium text-muted"
                      style={{ gridColumn: i + 1, gridRow: MAX_LANES + 2 }}
                    >
                      +{n} more
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearGrid({
  year,
  entries,
  today,
  onPickMonth,
}: {
  year: number;
  entries: Entry[];
  today: string;
  onPickMonth: (month: number) => void;
}) {
  // Which tasks block out each day of the year.
  const busy = useMemo(() => {
    const map = new Map<string, string[]>();
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    for (const e of entries) {
      if (e.end < from || e.start > to) continue;
      const [sy, sm, sd] = (e.start < from ? from : e.start).split("-").map(Number);
      const last = e.end > to ? to : e.end;
      for (let d = new Date(sy, sm - 1, sd); iso(d) <= last; d.setDate(d.getDate() + 1)) {
        const k = iso(d);
        map.set(k, [...(map.get(k) ?? []), e.label]);
      }
    }
    return map;
  }, [entries, year]);

  const shade = (n: number) =>
    n === 0 ? "" : n === 1 ? "bg-accent/25" : n === 2 ? "bg-accent/50 text-white" : "bg-accent text-accent-fg";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, m) => {
          const first = new Date(year, m, 1);
          const count = new Date(year, m + 1, 0).getDate();
          const cells = [
            ...Array.from({ length: first.getDay() }, () => null),
            ...Array.from({ length: count }, (_, i) => iso(new Date(year, m, i + 1))),
          ];
          const busyDays = cells.filter((k) => k && busy.has(k)).length;
          return (
            <div key={m} className="rounded-2xl border border-line p-3">
              <button
                onClick={() => onPickMonth(m)}
                className="mb-2 flex w-full items-baseline justify-between rounded px-1 text-left hover:text-accent"
                title="Open this month"
              >
                <span className="font-medium">{first.toLocaleDateString("en-US", { month: "long" })}</span>
                <span className="text-xs text-muted">{busyDays ? `${busyDays} busy day${busyDays > 1 ? "s" : ""}` : ""}</span>
              </button>
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {WEEKDAYS.map((d) => (
                  <span key={d} className="pb-1 text-[10px] font-semibold uppercase text-muted">{d[0]}</span>
                ))}
                {cells.map((k, i) => {
                  if (!k) return <span key={`blank-${i}`} />;
                  const names = busy.get(k) ?? [];
                  return (
                    <button
                      key={k}
                      onClick={() => onPickMonth(m)}
                      title={names.length ? `${formatDate(k)}\n${names.join("\n")}` : formatDate(k)}
                      className={`flex aspect-square items-center justify-center rounded-md text-[11px] ${shade(names.length)} ${
                        k === today ? "font-bold ring-2 ring-accent" : ""
                      } hover:ring-1 hover:ring-accent/60`}
                    >
                      {Number(k.slice(8))}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>Tasks on a day:</span>
        {[1, 2, 3].map((n) => (
          <span key={n} className="flex items-center gap-1.5">
            <span className={`h-3.5 w-3.5 rounded ${shade(n)}`} /> {n === 3 ? "3+" : n}
          </span>
        ))}
      </div>
    </>
  );
}
