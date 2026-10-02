"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { PALETTE } from "@/lib/format";
import type { Option, Role } from "@/lib/types";
import { useWorkspace } from "@/components/workspace";
import { Avatar, PasswordInput, Popover, btnOutline, btnPrimary, field } from "@/components/ui";
import { IconDown, IconTrash, IconUp, IconX } from "@/components/icons";
import { confirmDialog, notify } from "@/components/dialogs";

export default function SettingsPage() {
  const { isAdmin, statuses, stages, categories } = useWorkspace();
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <ProfileSection />
      <PasswordSection />
      <TeamSection />
      {categories.length === 0 ? (
        <OptionsSection
          table="stages"
          title="Stages"
          hint="The production stages each task or subitem can be in."
          items={stages}
          editable={isAdmin}
        />
      ) : (
        <>
          <OptionsSection
            table="categories"
            title="Project categories"
            hint="Each project belongs to one category, which decides the stages its subitems can use."
            items={categories}
            editable={isAdmin}
          />
          {categories.map((c) => (
            <OptionsSection
              key={c.id}
              table="stages"
              title={`${c.name} stages`}
              hint={`The stages offered on ${c.name} projects.`}
              items={stages.filter((s) => s.category_id === c.id)}
              insertExtra={{ category_id: c.id }}
              editable={isAdmin}
            />
          ))}
        </>
      )}
      <OptionsSection
        table="statuses"
        title="Statuses"
        hint="The groups on a project follow this order. A status named “Done” marks due dates as complete."
        items={statuses}
        editable={isAdmin}
      />
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-panel/90 p-6 shadow-card backdrop-blur">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ColorPicker({ value, onChange, disabled }: { value: string; onChange: (c: string) => void; disabled?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className="h-7 w-7 shrink-0 rounded-md border border-line"
        style={{ background: value }}
        title="Change color"
      />
      <Popover anchor={anchor} onClose={() => setAnchor(null)} width={184} align="start">
        <div className="grid grid-cols-4 gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(c); setAnchor(null); }}
              className={`h-9 w-9 rounded-md ${c === value ? "ring-2 ring-fg ring-offset-2 ring-offset-panel" : ""}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </Popover>
    </>
  );
}

function ProfileSection() {
  const { me, reload } = useWorkspace();
  const [name, setName] = useState(me.full_name);
  const [saved, setSaved] = useState(false);

  const save = async (patch: { full_name?: string; color?: string }) => {
    const { error } = await supabase().from("profiles").update(patch).eq("id", me.id);
    if (error) return notify(error.message);
    await reload();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Card title="Your profile">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar profile={me} size={40} />
        <ColorPicker value={me.color} onChange={(color) => save({ color })} />
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} min-w-0 flex-1`} />
        <button
          disabled={!name.trim() || name.trim() === me.full_name}
          onClick={() => save({ full_name: name.trim() })}
          className={btnPrimary}
        >
          Save
        </button>
        {saved && <span className="text-sm text-emerald-500">Saved</span>}
      </div>
      <p className="mt-2 text-sm text-muted">{me.email}</p>
    </Card>
  );
}

function PasswordSection() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (error) return notify(error.message);
    setPassword("");
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card title="Change password" hint="Sets a new password for your account. You stay signed in here.">
      <form onSubmit={save} className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder="New password (6+ characters)" />
        </div>
        <button disabled={busy || password.length < 6} className={btnPrimary}>
          {busy ? "Saving…" : "Update password"}
        </button>
        {saved && <span className="text-sm text-emerald-500">Password updated</span>}
      </form>
    </Card>
  );
}

function TeamSection() {
  const { me, isAdmin, profiles, reload } = useWorkspace();
  const [invites, setInvites] = useState<{ email: string; created_at: string }[]>([]);
  const [email, setEmail] = useState("");

  const loadInvites = async () => {
    const { data } = await supabase().from("invites").select("email, created_at").order("created_at");
    setInvites(data ?? []);
  };
  useEffect(() => {
    loadInvites();
  }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    if (profiles.some((p) => p.email === clean)) return notify("That person is already on the team.");
    const { error } = await supabase().from("invites").insert({ email: clean });
    if (error) return notify(error.code === "23505" ? "Already invited." : error.message);
    setEmail("");
    loadInvites();
  };

  const revoke = async (address: string) => {
    const { error } = await supabase().from("invites").delete().eq("email", address);
    if (error) return notify(error.message);
    loadInvites();
  };

  const setRole = async (id: string, role: Role) => {
    const { error } = await supabase().from("profiles").update({ role }).eq("id", id);
    if (error) notify(error.message);
    reload();
  };

  const removeMember = async (id: string, name: string) => {
    if (!(await confirmDialog(`Remove ${name} from Task Flow? Their tasks stay, but they lose access.`))) return;
    const { error } = await supabase().from("profiles").delete().eq("id", id);
    if (error) notify(error.message);
    reload();
  };

  const signupUrl = typeof window === "undefined" ? "" : `${window.location.origin}/login`;

  return (
    <Card title={`Team · ${profiles.length} member${profiles.length === 1 ? "" : "s"}`} hint="Admins invite people and manage stages and statuses. Members create and edit tasks.">
      <ul className="divide-y divide-line">
        {profiles.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <Avatar profile={p} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {p.full_name} {p.id === me.id && <span className="text-muted">(you)</span>}
              </div>
              <div className="truncate text-xs text-muted">{p.email}</div>
            </div>
            {isAdmin && p.id !== me.id ? (
              <>
                <select
                  value={p.role}
                  onChange={(e) => setRole(p.id, e.target.value as Role)}
                  className={`${field} py-1`}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={() => removeMember(p.id, p.full_name)} className="rounded p-1.5 text-muted hover:bg-hover hover:text-red-500" title="Remove">
                  <IconTrash />
                </button>
              </>
            ) : (
              <span className="text-sm capitalize text-muted">{p.role}</span>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="mt-5 border-t border-line pt-5">
          <form onSubmit={invite} className="flex flex-wrap gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className={`${field} min-w-0 flex-1`}
            />
            <button disabled={!email.trim()} className={btnPrimary}>Invite</button>
          </form>
          <p className="mt-2 text-xs text-muted">
            After inviting, send them this link to create their account: <span className="font-medium text-fg">{signupUrl}</span>
          </p>
          {invites.length > 0 && (
            <ul className="mt-3 space-y-1">
              {invites.map((i) => (
                <li key={i.email} className="flex items-center gap-2 rounded-md bg-panel-2 px-3 py-1.5 text-sm">
                  <span className="flex-1 truncate">{i.email}</span>
                  <span className="text-xs text-muted">Pending</span>
                  <button onClick={() => revoke(i.email)} className="rounded p-1 text-muted hover:text-red-500" title="Revoke invite">
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function OptionsSection({
  table,
  title,
  hint,
  items,
  editable,
  insertExtra,
}: {
  table: "stages" | "statuses" | "categories";
  title: string;
  hint: string;
  items: Option[];
  editable: boolean;
  /** Extra columns for new rows, e.g. the category a new stage belongs to. */
  insertExtra?: Record<string, string>;
}) {
  const { reload } = useWorkspace();
  const [newName, setNewName] = useState("");
  const sb = () => supabase().from(table);

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    if (error) notify(error.message);
    reload();
  };

  const rename = (o: Option, name: string) => {
    if (name.trim() && name.trim() !== o.name) run(sb().update({ name: name.trim() }).eq("id", o.id));
  };

  const move = async (index: number, dir: -1 | 1) => {
    const a = items[index];
    const b = items[index + dir];
    if (!a || !b) return;
    const aPos = a.position === b.position ? index : a.position;
    const bPos = a.position === b.position ? index + dir : b.position;
    await sb().update({ position: bPos }).eq("id", a.id);
    await run(sb().update({ position: aPos }).eq("id", b.id));
  };

  const remove = async (o: Option) => {
    const consequence =
      table === "categories"
        ? "Its stages are deleted too, and projects in it will have no category."
        : "Tasks using it will be left blank.";
    if (!(await confirmDialog(`Delete “${o.name}”? ${consequence}`))) return;
    run(sb().delete().eq("id", o.id));
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const color = PALETTE[(items.length * 3 + 1) % PALETTE.length];
    const position = items.reduce((m, o) => Math.max(m, o.position), -1) + 1;
    setNewName("");
    run(sb().insert({ name, color, position, ...insertExtra }));
  };

  return (
    <Card title={title} hint={editable ? hint : `${hint} Only admins can edit these.`}>
      <ul className="space-y-2">
        {items.map((o, i) => (
          <li key={o.id} className="flex items-center gap-2">
            <ColorPicker value={o.color} disabled={!editable} onChange={(color) => run(sb().update({ color }).eq("id", o.id))} />
            <input
              key={o.name}
              defaultValue={o.name}
              disabled={!editable}
              onBlur={(e) => rename(o, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className={`${field} min-w-0 flex-1 disabled:opacity-70`}
            />
            {editable && (
              <>
                <button disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1.5 text-muted hover:bg-hover disabled:opacity-30" title="Move up">
                  <IconUp />
                </button>
                <button disabled={i === items.length - 1} onClick={() => move(i, 1)} className="rounded p-1.5 text-muted hover:bg-hover disabled:opacity-30" title="Move down">
                  <IconDown />
                </button>
                <button onClick={() => remove(o)} className="rounded p-1.5 text-muted hover:bg-hover hover:text-red-500" title="Delete">
                  <IconTrash />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <form onSubmit={add} className="mt-3 flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={table === "stages" ? "New stage" : table === "categories" ? "New category" : "New status"} className={`${field} min-w-0 flex-1`} />
          <button disabled={!newName.trim()} className={btnOutline}>Add</button>
        </form>
      )}
    </Card>
  );
}
