import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Links from Supabase emails (confirm sign-up, reset password) land here with a one-time code.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only ever redirect to a path on this site.
  const requested = searchParams.get("next") ?? "/";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  // The code only works in the browser that asked for it, and only once.
  return NextResponse.redirect(`${origin}/login?${next === "/reset-password" ? "reset_failed=1" : "confirmed=1"}`);
}
