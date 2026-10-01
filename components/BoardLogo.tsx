"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";
import { useWorkspace } from "./workspace";
import { btnGhost, btnPrimary, field } from "./ui";
import { IconPlus, IconX } from "./icons";
import { CategoryIcon } from "./CategoryIcon";
import { notify } from "./dialogs";

const MAX_SIDE = 512;

/** Shrinks an image file and returns it as a data URL small enough to store on the board row. */
export async function fileToLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const srcW = img.naturalWidth || MAX_SIDE;
    const srcH = img.naturalHeight || MAX_SIDE;
    const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(srcW * scale));
    canvas.height = Math.max(1, Math.round(srcH * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Explains the one-time database change the logo feature needs. */
export function logoError(message: string) {
  return /logo/i.test(message)
    ? "Logos need a one-time database update. In Supabase → SQL Editor, run:\n\nalter table public.boards add column if not exists logo text;"
    : message;
}

/** Square button that shows the chosen logo, or a placeholder to pick one. */
export function LogoPicker({ value, onChange }: { value: string | null; onChange: (logo: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      onChange(await fileToLogo(file));
    } catch {
      notify("That file couldn't be read as an image. Try a PNG, JPG or SVG.");
    }
  };
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-[#3d4080]/10 text-muted hover:border-accent hover:text-fg"
        title="Upload logo"
      >
        {value ? <img src={value} alt="Logo preview" className="h-full w-full object-contain p-1.5" /> : <IconPlus className="h-6 w-6" />}
      </button>
      <div className="text-sm">
        <button type="button" onClick={() => input.current?.click()} className="font-medium text-accent hover:underline">
          {value ? "Change logo" : "Upload brand logo"}
        </button>
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="ml-3 text-muted hover:text-red-500">
            Remove
          </button>
        ) : (
          <p className="text-xs text-muted">Optional. PNG, JPG or SVG.</p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Name + optional logo. Creates the board and opens it. */
export function NewBoardForm({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const { boards, categories } = useWorkspace();
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(categories[0]?.id ?? null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase()
      .from("boards")
      .insert({ name: name.trim(), position: boards.length, ...(logo ? { logo } : {}), ...(category ? { category_id: category } : {}) })
      .select()
      .single();
    setBusy(false);
    if (error) return notify(logoError(error.message));
    onDone?.();
    router.push(`/board/${data.id}`);
  };

  return (
    <form onSubmit={create} className="flex flex-col gap-4 text-left">
      <LogoPicker value={logo} onChange={setLogo} />
      <label className="flex flex-col gap-1 text-sm">
        Brand / project name
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Telegra" className={field} />
      </label>
      {categories.length > 0 && (
        <div className="flex flex-col gap-1.5 text-sm">
          Project category
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition ${
                  category === c.id ? "border-accent bg-accent text-accent-fg" : "border-line hover:bg-hover"
                }`}
              >
                <CategoryIcon category={c} size={22} />
                {c.name}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">Decides which stages this project&apos;s subitems can use.</span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className={btnGhost}>
            Cancel
          </button>
        )}
        <button disabled={busy || !name.trim()} className={btnPrimary}>
          {busy ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}

export function NewBoardDialog({ onClose }: { onClose: () => void }) {
  // Rendered on <body> so the sidebar's transform doesn't trap the overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-line bg-panel p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New project</h2>
          <button onClick={onClose} className="rounded p-1.5 text-muted hover:bg-hover hover:text-fg" aria-label="Close">
            <IconX />
          </button>
        </div>
        <NewBoardForm onDone={onClose} onCancel={onClose} />
      </div>
    </div>,
    document.body,
  );
}
