"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Logo } from "@/components/icons";
import { PasswordInput, btnPrimary } from "@/components/ui";

/** Reached from the "reset your password" email, already signed in by the link. */
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    window.location.href = "/";
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="h-12 w-12" />
          <h1 className="text-2xl font-semibold">Choose a new password</h1>
        </div>
        <form onSubmit={save} className="flex flex-col gap-3 rounded-3xl bg-panel/90 p-6 shadow-card backdrop-blur">
          <label className="flex flex-col gap-1 text-sm">
            New password
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 6 characters" />
          </label>
          {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={busy || password.length < 6} className={`${btnPrimary} mt-1 justify-center py-2`}>
            {busy ? "Saving…" : "Save and continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
