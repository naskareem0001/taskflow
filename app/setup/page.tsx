import { Logo } from "@/components/icons";

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8 flex items-center gap-3">
        <Logo className="h-9 w-9" />
        <h1 className="text-2xl font-semibold">FrameFlow setup</h1>
      </div>
      <div className="space-y-6 rounded-xl border border-line bg-panel p-6 text-sm leading-6">
        <p>FrameFlow isn&apos;t connected to a database yet. Three steps:</p>
        <ol className="list-decimal space-y-4 pl-5">
          <li>
            Create a free project at <b>supabase.com</b>. Then open <b>SQL Editor</b>, paste the contents of{" "}
            <code className="rounded bg-panel-2 px-1">supabase/schema.sql</code>, and click <b>Run</b>.
          </li>
          <li>
            In Supabase, open <b>Project Settings → API</b> and copy the <b>Project URL</b> and the{" "}
            <b>anon / publishable key</b>.
          </li>
          <li>
            Copy <code className="rounded bg-panel-2 px-1">.env.local.example</code> to{" "}
            <code className="rounded bg-panel-2 px-1">.env.local</code>, paste both values in, and restart{" "}
            <code className="rounded bg-panel-2 px-1">npm run dev</code>.
          </li>
        </ol>
        <p className="text-muted">The first person to sign up becomes the admin and can invite the rest of the team.</p>
      </div>
    </main>
  );
}
