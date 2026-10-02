"use client";

import { useRef, useState } from "react";
import { isDoneName } from "@/lib/format";
import type { Option, Task } from "@/lib/types";
import { useWorkspace } from "../workspace";
import { InlineText, Popover } from "../ui";
import { IconChat, IconCheck, IconChevron, IconDoc, IconDots, IconPlus, IconTrash } from "../icons";
import { linksOf } from "./links";
import { ApprovalCell, DateCell, LinkCell, OptionCell, PersonCell } from "./cells";

/** Shared column layout: task name, stage, link, requestor, owner, date, status, approval. */
export const GRID = "grid grid-cols-[minmax(300px,1fr)_130px_130px_104px_104px_120px_140px_150px]";

/** A subitem is named after its stage, so changing the stage renames it too. */
export function stagePatch(stages: Option[], stage_id: string | null): Partial<Task> {
  const stage = stages.find((s) => s.id === stage_id);
  return stage ? { stage_id, title: stage.name } : { stage_id };
}

const cell = "flex h-full items-center justify-center overflow-hidden border-r border-line last:border-r-0";

// Checkboxes sit in the gutter to the left of the table, outside its border,
// so they aren't ticked by accident. Subitem rows are inset by 4px more.
const checkbox = "absolute top-1/2 h-4 w-4 -translate-y-1/2 cursor-pointer accent-[var(--accent)]";
const gutter = (sub?: boolean) => (sub ? "-left-[31px]" : "-left-[27px]");

export function HeaderRow({
  first,
  sub,
  allSelected = false,
  onSelectAll,
}: {
  first: string;
  sub?: boolean;
  allSelected?: boolean;
  /** Ticks or unticks every row under this header. */
  onSelectAll?: () => void;
}) {
  // Subitems are stages, so their name column and Stage column are one merged column.
  const cols = sub
    ? [first, "Link", "Requestor", "Owner", "Date", "Status", "Approval"]
    : [first, "Stage", "Link", "Requestor", "Owner", "Due date", "Status", "Approval"];
  return (
    <div className={`${GRID} relative h-9 border-b border-line text-[11px] font-semibold uppercase tracking-wider text-muted ${sub ? "bg-panel-2/60" : "bg-panel-2"}`}>
      {onSelectAll && (
        <input
          type="checkbox"
          className={`${checkbox} ${gutter(sub)}`}
          checked={allSelected}
          onChange={onSelectAll}
          aria-label="Select all"
        />
      )}
      {cols.map((c, i) => (
        <div key={c} className={i === 0 ? `flex items-center border-r border-line ${sub ? "col-span-2 pl-12" : "pl-10"}` : cell}>
          {c}
        </div>
      ))}
    </div>
  );
}

export function TaskRow({
  task,
  sub = false,
  childCount = 0,
  stageLocked = false,
  expanded = false,
  commentCount = 0,
  autoEdit = false,
  selected = false,
  onSelect,
  onToggle,
  onOpen,
  onOpenApproval,
  onOpenBrief,
  onUpdate,
  onDelete,
  onAddSub,
}: {
  task: Task;
  sub?: boolean;
  childCount?: number;
  /** Stage is driven by the subitems, so it can't be edited on the task itself. */
  stageLocked?: boolean;
  expanded?: boolean;
  commentCount?: number;
  autoEdit?: boolean;
  selected?: boolean;
  onSelect: () => void;
  onToggle?: () => void;
  /** Opens the chat for this row. */
  onOpen: () => void;
  onOpenApproval: () => void;
  onOpenBrief: () => void;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onAddSub?: () => void;
}) {
  const { statuses, stages, allStages } = useWorkspace();
  const tint = sub ? allStages.find((s) => s.id === task.stage_id)?.color : undefined;
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const done = isDoneName(statuses.find((s) => s.id === task.status_id)?.name);

  return (
    <div
      className={`${GRID} group relative h-10 border-b border-line text-sm ${selected ? "bg-accent/15" : sub ? "bg-panel-2/60" : ""}`}
      // A subitem's whole row carries a light wash of its stage colour, so the stage reads at a glance.
      style={
        tint && !selected
          ? { background: `color-mix(in srgb, ${tint} 24%, transparent)`, boxShadow: `inset 4px 0 0 ${tint}` }
          : undefined
      }
    >
      <input
        type="checkbox"
        className={`${checkbox} ${gutter(sub)}`}
        checked={selected}
        onChange={onSelect}
        aria-label={`Select ${task.title}`}
      />
      <div className={`flex min-w-0 items-center gap-1 border-r border-line pr-1 ${sub ? "col-span-2 pl-12" : "pl-2"}`}>
        {!sub && (
          <button
            onClick={onToggle}
            className="rounded p-1 text-muted hover:bg-hover hover:text-fg"
            title={expanded ? "Hide subitems" : "Show subitems"}
          >
            <IconChevron className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}
        {sub ? (
          <div className="-ml-1.5 flex w-48 shrink-0">
            <OptionCell
              value={task.stage_id}
              options={stages}
              emptyLabel={task.title || "Choose stage"}
              onChange={(stage_id) => onUpdate(stagePatch(stages, stage_id))}
            />
          </div>
        ) : (
          <InlineText
            value={task.title}
            onSave={(title) => onUpdate({ title })}
            autoEdit={autoEdit}
            className={done ? "text-muted" : ""}
          />
        )}
        {!sub && childCount > 0 && (
          <button onClick={onToggle} className="shrink-0 rounded bg-hover px-1.5 text-xs text-muted" title="Subitems">
            {childCount}
          </button>
        )}
        <div className="ml-auto flex shrink-0 items-center">
          <button
            onClick={onOpenBrief}
            className={`rounded p-1.5 hover:bg-hover hover:text-fg ${task.brief ? "text-accent" : "text-muted"}`}
            title={task.brief ? `Brief: ${task.brief.slice(0, 140)}` : "Add a brief"}
          >
            <IconDoc />
          </button>
          <button onClick={onOpen} className="relative rounded p-1.5 text-muted hover:bg-hover hover:text-fg" title="Open chat">
            <IconChat />
            {commentCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 text-white">
                {commentCount}
              </span>
            )}
          </button>
          <button
            onClick={(e) => setMenu(menu ? null : e.currentTarget)}
            className="rounded p-1.5 text-muted opacity-0 hover:bg-hover hover:text-fg focus:opacity-100 group-hover:opacity-100"
            title="More"
          >
            <IconDots />
          </button>
          <Popover anchor={menu} onClose={() => setMenu(null)} width={180} align="end">
            <button onClick={() => { setMenu(null); onOpenBrief(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hover">
              <IconDoc /> Brief &amp; links
            </button>
            <button onClick={() => { setMenu(null); onOpen(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hover">
              <IconChat /> Chat
            </button>
            {onAddSub && (
              <button onClick={() => { setMenu(null); onAddSub(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-hover">
                <IconPlus /> Add subitem
              </button>
            )}
            <button onClick={() => { setMenu(null); onDelete(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-red-500 hover:bg-hover">
              <IconTrash /> Delete
            </button>
          </Popover>
        </div>
      </div>
      {!sub && (
        <div className={cell}>
          {stageLocked ? (
            <StageLabel id={task.stage_id} />
          ) : (
            <OptionCell value={task.stage_id} options={stages} onChange={(stage_id) => onUpdate({ stage_id })} />
          )}
        </div>
      )}
      <div className={cell}>
        <LinkCell value={linksOf(task)} onChange={(links) => onUpdate({ links })} />
      </div>
      <div className={cell}>
        <PersonCell value={task.requestor_id} onChange={(requestor_id) => onUpdate({ requestor_id })} />
      </div>
      <div className={cell}>
        <PersonCell value={task.owner_id} onChange={(owner_id) => onUpdate({ owner_id })} />
      </div>
      <div className={cell}>
        <DateCell value={task.due_date} done={done} onChange={(due_date) => onUpdate({ due_date })} />
      </div>
      <div className={cell}>
        <OptionCell value={task.status_id} options={statuses} onChange={(status_id) => onUpdate({ status_id })} />
      </div>
      <div className={cell}>
        <ApprovalCell state={task.approval} onOpen={onOpenApproval} />
      </div>
    </div>
  );
}

/** Read-only stage cell for tasks whose stage comes from their subitems. */
export function StageLabel({ id }: { id: string | null }) {
  const { allStages } = useWorkspace();
  const stage = allStages.find((s) => s.id === id);
  return (
    <div
      title="Set automatically: the last subitem that is Doing or Done"
      className="mx-1.5 flex h-7 min-w-0 flex-1 items-center justify-center truncate rounded-full px-3 text-[13px] font-medium text-white"
      style={{ background: stage ? stage.color : "var(--empty)" }}
    >
      {stage?.name}
    </div>
  );
}

export function AddRow({ placeholder, onAdd, sub = false }: { placeholder: string; onAdd: (title: string) => void; sub?: boolean }) {
  const [value, setValue] = useState("");
  const cancelled = useRef(false);
  const submit = () => {
    const t = value.trim();
    if (cancelled.current || !t) {
      cancelled.current = false;
      return;
    }
    onAdd(t);
    setValue("");
  };
  return (
    <div className={`${GRID} h-10 border-b border-line text-sm ${sub ? "bg-panel-2/60" : ""}`}>
      <div className={`flex items-center border-r border-line pr-2 ${sub ? "pl-12" : "pl-10"}`}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              cancelled.current = true;
              setValue("");
              e.currentTarget.blur();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 outline-none placeholder:text-muted hover:border-line focus:border-accent"
        />
      </div>
      <div className="col-span-7" />
    </div>
  );
}

/** "+ Add subitem": pick which stage the new subitem is. Stages already added are ticked. */
export function AddStageRow({ used, onAdd }: { used: string[]; onAdd: (stage: Option) => void }) {
  const { stages } = useWorkspace();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <div className={`${GRID} h-10 border-b border-line bg-panel-2/60 text-sm`}>
      <div className="col-span-2 flex items-center border-r border-line pl-12 pr-2">
        <button
          onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
          className="flex items-center gap-1 rounded border border-transparent px-1.5 py-1 text-muted hover:border-line hover:text-fg"
        >
          <IconPlus className="h-3.5 w-3.5" /> Add subitem
        </button>
        <Popover anchor={anchor} onClose={() => setAnchor(null)} width={200} align="start">
          <div className="flex flex-col gap-1.5">
            {stages.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setAnchor(null);
                  onAdd(s);
                }}
                className="relative rounded-full px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
                style={{ background: s.color }}
              >
                {s.name}
                {used.includes(s.id) && <IconCheck className="absolute right-2 top-2 h-4 w-4" />}
              </button>
            ))}
            {!stages.length && <p className="px-1 py-2 text-sm text-muted">No stages yet. Add some in Settings.</p>}
          </div>
        </Popover>
      </div>
      <div className="col-span-6" />
    </div>
  );
}
