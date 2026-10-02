"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Logo } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PasswordInput, btnPrimary, field } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    params.get("confirmed") ? "Email confirmed. Sign in to continue." : null,
  );
  const [error0] = useState<string | null>(
    params.get("reset_failed")
      ? "That reset link didn't work. Links work once, in the browser that asked for them. Request a new one below."
      : null,
  );

  // Emails a link that signs the person in and takes them to choose a new password.
  const forgot = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Type your email above first, then click “Forgot password?”.");
      return;
    }
    setBusy(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo("If that email has an account, a reset link is on its way. Open it in this same browser.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const sb = supabase();
    if (mode === "signin") {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      window.location.href = "/";
      return;
    }
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) {
      setError(
        /database error/i.test(error.message)
          ? "This email hasn't been invited yet. Ask your Task Flow admin to invite you."
          : error.message,
      );
      return;
    }
    if (data.session) {
      window.location.href = "/";
      return;
    }
    setInfo("Almost there. Check your inbox to confirm your email, then sign in.");
    setMode("signin");
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="h-12 w-12" />
          <h1 className="text-2xl font-semibold">Task Flow</h1>
          <p className="text-sm text-muted">Project tracking for your creative team</p>
        </div>

        <div className="rounded-3xl bg-panel/90 p-6 shadow-card backdrop-blur">
          <div className="mb-5 grid grid-cols-2 rounded-full bg-panel-2 p-1 text-sm font-medium">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-full py-1.5 transition ${mode === m ? "bg-panel shadow-sm" : "text-muted hover:text-fg"}`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <label className="flex flex-col gap-1 text-sm">
                Full name
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Password
              <PasswordInput
                value={password}
                onChange={setPassword}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </label>

            {mode === "signin" && (
              <button type="button" onClick={forgot} disabled={busy} className="-mt-1 self-end text-xs text-accent hover:underline">
                Forgot password?
              </button>
            )}

            {(error ?? error0) && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error ?? error0}</p>}
            {info && <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">{info}</p>}

            <button type="submit" disabled={busy} className={`${btnPrimary} mt-1 justify-center py-2`}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {mode === "signup" && (
            <p className="mt-4 text-xs leading-5 text-muted">
              Task Flow is invite-only. Use the email your admin invited. The very first account becomes the admin.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
