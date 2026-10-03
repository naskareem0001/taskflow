"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { initials } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { IconEye, IconEyeOff } from "./icons";

export const btn =
  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${btn} bg-accent text-accent-fg shadow-sm hover:brightness-110`;
export const btnGhost = `${btn} bg-panel/70 text-fg shadow-sm hover:bg-panel`;
export const btnOutline = `${btn} border border-line bg-panel hover:bg-hover`;
export const field =
  "rounded-xl border border-line bg-panel px-3.5 py-2 text-sm outline-none placeholder:text-muted focus:border-accent";

export function Avatar({ profile, size = 28 }: { profile?: Profile; size?: number }) {
  if (!profile) return null;
  const label = profile.full_name || profile.email;
  if (profile.avatar) {
    return (
      <img
        src={profile.avatar}
        alt={label}
        title={label}
        className="inline-block shrink-0 select-none rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      title={label}
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: profile.color, fontSize: Math.round(size * 0.38) }}
    >
      {initials(label)}
    </span>
  );
}

/**
 * Floating panel anchored to an element. Rendered in a portal with fixed
 * positioning so it isn't clipped by scrolling tables. Open when `anchor` is set.
 */
export function Popover({
  anchor,
  onClose,
  width = 220,
  align = "center",
  children,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  width?: number;
  align?: "center" | "start" | "end";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor) {
      setPos(null);
      return;
    }
    const r = anchor.getBoundingClientRect();
    let left = align === "start" ? r.left : align === "end" ? r.right - width : r.left + r.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const h = ref.current?.offsetHeight ?? 0;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
    setPos({ top, left });
  }, [anchor, width, align]);

  // Re-measure once content has rendered so we can flip above the anchor if needed.
  useLayoutEffect(() => {
    if (!anchor || !ref.current || !pos) return;
    const h = ref.current.offsetHeight;
    const r = anchor.getBoundingClientRect();
    if (pos.top + h > window.innerHeight - 8 && r.top - h - 6 > 8 && pos.top > r.top) {
      setPos({ ...pos, top: r.top - h - 6 });
    }
  }, [anchor, pos]);

  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  if (!anchor || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      data-popover
      style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
      className="z-[60] rounded-2xl border border-line bg-panel p-2 text-fg shadow-card"
    >
      {children}
    </div>,
    document.body,
  );
}

/** Click-to-edit single line of text. Enter saves, Escape cancels. */
export function InlineText({
  value,
  onSave,
  className = "",
  placeholder = "Untitled",
  autoEdit = false,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
  autoEdit?: boolean;
}) {
  const [editing, setEditing] = useState(autoEdit);
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    setEditing(false);
    const v = draft.trim();
    if (v && v !== value) onSave(v);
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.stopPropagation();
            cancelled.current = true;
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`w-full min-w-0 rounded border border-accent bg-panel px-1.5 py-0.5 outline-none ${className}`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`min-w-0 truncate rounded border border-transparent px-1.5 py-0.5 text-left hover:border-line ${className}`}
    >
      {value || <span className="text-muted">{placeholder}</span>}
    </button>
  );
}

export function Spinner() {
  return <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />;
}

/** Password field with a show/hide button. */
export function PasswordInput({
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className={`${field} w-full pr-10`}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-fg"
        title={show ? "Hide password" : "Show password"}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  );
}
