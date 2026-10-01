"use client";

import { useEffect, useState } from "react";
import { btnOutline, btnPrimary } from "./ui";
import { IconX } from "./icons";

/**
 * In-app replacements for the browser's confirm() and alert(). Embedded
 * browsers can silently block those, which made deletes look broken, and they
 * don't match the app's look anyway. Mount <DialogHost /> once at the root.
 */
type Confirm = { message: string; resolve: (ok: boolean) => void };
type Toast = { id: number; message: string };

let setConfirm: ((c: Confirm | null) => void) | null = null;
let pushToast: ((message: string) => void) | null = null;

/** Asks the person to confirm. Resolves true if they agree. */
export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setConfirm) return resolve(window.confirm(message));
    setConfirm({ message, resolve });
  });
}

/** Shows a short message (usually an error) at the bottom of the screen. */
export function notify(message: string) {
  if (pushToast) pushToast(message);
  else console.error(message);
}

export function DialogHost() {
  const [pending, setPending] = useState<Confirm | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    setConfirm = setPending;
    pushToast = (message) => {
      const id = Date.now() + Math.random();
      setToasts((ts) => [...ts, { id, message }]);
      setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 8000);
    };
    return () => {
      setConfirm = null;
      pushToast = null;
    };
  }, []);

  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  // Enter confirms, Escape cancels; captured first so the panel behind doesn't also close.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      pending.resolve(e.key === "Enter");
      setPending(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pending]);

  const verb = pending && /^(Delete|Remove)\b/.exec(pending.message)?.[1];

  return (
    <>
      {pending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={() => answer(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl border border-line bg-panel p-6 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="whitespace-pre-wrap text-sm leading-6">{pending.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => answer(false)} className={btnOutline}>
                Cancel
              </button>
              <button autoFocus onClick={() => answer(true)} className={`${btnPrimary} ${verb ? "!bg-red-600" : ""}`}>
                {verb ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
          {toasts.map((t) => (
            <div key={t.id} role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-panel px-4 py-3 text-sm shadow-2xl">
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{t.message}</p>
              <button onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} className="rounded-full p-1 text-muted hover:bg-hover hover:text-fg" aria-label="Dismiss">
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
