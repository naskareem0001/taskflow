"use client";

import { useState } from "react";
import { IconCheck } from "./icons";

/**
 * Task Flow doesn't email invites itself, so admins send this text to the
 * person over WhatsApp, email, Slack, etc.
 */
export function inviteMessage({ email, project, existing }: { email: string; project?: string; existing?: boolean }) {
  const link = `${window.location.origin}/login`;
  if (existing) {
    return `Hi! I've added you to the "${project}" project on Task Flow. Sign in at ${link} to see it.`;
  }
  const where = project ? `the "${project}" project on Task Flow` : "Task Flow";
  return [
    `Hi! You've been invited to ${where}.`,
    "",
    `1. Go to ${link}`,
    `2. Click "Create account"`,
    `3. Sign up with this email: ${email}`,
    "",
    project ? "You'll see the project as soon as you're in." : "You'll see your projects once you're added to them.",
  ].join("\n");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / blocked clipboard API: fall back to a hidden textarea.
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}

/** Small button that copies an invite message and confirms with "Copied". */
export function CopyInviteButton({ text, label = "Copy invite message" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
        copied ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-accent/15 text-accent hover:bg-accent/25"
      }`}
    >
      {copied ? (
        <>
          <IconCheck className="h-3.5 w-3.5" /> Copied
        </>
      ) : (
        label
      )}
    </button>
  );
}
