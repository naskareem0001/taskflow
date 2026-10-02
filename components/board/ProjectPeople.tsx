"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { useWorkspace } from "../workspace";
import { Avatar, Popover, btnGhost, btnPrimary, field } from "../ui";
import { IconPlus, IconX } from "../icons";
import { CopyInviteButton, inviteMessage } from "../CopyInvite";
import { confirmDialog, notify } from "../dialogs";

/**
 * Toolbar button showing who is on this project. Admins can add teammates,
 * invite new people by email, and remove people; members can only look.
 */
export function ProjectPeople({
  boardId,
  boardName,
  people,
  memberIds,
  allProfiles,
  onChanged,
}: {
  boardId: string;
  boardName: string;
  /** Everyone who can open this project: its members plus all admins. */
  people: Profile[];
  memberIds: string[];
  /** Every profile the signed-in user can see (for admins: the whole team). */
  allProfiles: Profile[];
  onChanged: () => void;
}) {
  const { isAdmin, me } = useWorkspace();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  // The person just invited or added, so the admin can copy a message to send them.
  const [note, setNote] = useState<{ email: string; existing: boolean } | null>(null);

  const loadPending = useCallback(async () => {
    if (!isAdmin) return;
    const { data } = await supabase().from("board_invites").select("email").eq("board_id", boardId).order("created_at");
    setPending(((data ?? []) as { email: string }[]).map((r) => r.email));
  }, [boardId, isAdmin]);

  useEffect(() => {
    if (anchor) loadPending();
  }, [anchor, loadPending]);

  const invite = async (address: string) => {
    setBusy(true);
    setNote(null);
    const { data, error } = await supabase().rpc("invite_to_board", { p_board: boardId, p_email: address });
    setBusy(false);
    if (error) return notify(error.message);
    setEmail("");
    setNote({ email: address.trim().toLowerCase(), existing: data !== "invited" });
    onChanged();
    loadPending();
  };

  const remove = async (p: Profile) => {
    if (!(await confirmDialog(`Remove ${p.full_name} from “${boardName}”? They will no longer see this project.`))) return;
    const { error } = await supabase().from("board_members").delete().eq("board_id", boardId).eq("user_id", p.id);
    if (error) return notify(error.message);
    onChanged();
  };

  const revoke = async (address: string) => {
    const { error } = await supabase().rpc("revoke_board_invite", { p_board: boardId, p_email: address });
    if (error) return notify(error.message);
    setNote(null);
    loadPending();
  };

  const candidates = allProfiles.filter((p) => p.role !== "admin" && !memberIds.includes(p.id));

  return (
    <>
      <button onClick={(e) => setAnchor(anchor ? null : e.currentTarget)} className={`${btnGhost} !py-1.5 !pl-2`} title="People on this project">
        <span className="flex -space-x-1.5">
          {people.slice(0, 4).map((p) => (
            <span key={p.id} className="rounded-full ring-2 ring-panel">
              <Avatar profile={p} size={24} />
            </span>
          ))}
        </span>
        {people.length > 4 ? `+${people.length - 4}` : isAdmin ? "Share" : "People"}
      </button>
      <Popover anchor={anchor} onClose={() => setAnchor(null)} width={340} align="end">
        <div className="p-1.5">
          <p className="font-medium">People on this project</p>
          <p className="mb-2 text-xs text-muted">Only these people can open “{boardName}”.</p>

          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl px-1.5 py-1.5">
                <Avatar profile={p} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {p.full_name} {p.id === me.id && <span className="text-muted">(you)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {p.role === "admin" ? "Admin · sees every project" : p.email}
                  </span>
                </span>
                {isAdmin && p.role !== "admin" && (
                  <button onClick={() => remove(p)} className="rounded-full p-1.5 text-muted hover:bg-hover hover:text-red-500" title="Remove from project">
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {isAdmin && (
            <div className="mt-2 border-t border-line pt-3">
              {candidates.length > 0 && (
                <>
                  <p className="mb-1 text-xs font-medium text-muted">Add a teammate</p>
                  <ul className="mb-3 max-h-32 space-y-0.5 overflow-y-auto">
                    {candidates.map((p) => (
                      <li key={p.id}>
                        <button
                          disabled={busy}
                          onClick={() => invite(p.email)}
                          className="flex w-full items-center gap-2 rounded-xl px-1.5 py-1.5 text-left text-sm hover:bg-hover"
                        >
                          <Avatar profile={p} size={24} />
                          <span className="min-w-0 flex-1 truncate">{p.full_name}</span>
                          <IconPlus className="h-4 w-4 text-muted" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mb-1 text-xs font-medium text-muted">Invite someone new by email</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) invite(email);
                }}
                className="flex gap-2"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className={`${field} min-w-0 flex-1`}
                />
                <button disabled={busy || !email.trim()} className={btnPrimary}>
                  Invite
                </button>
              </form>
              {note && (
                <div className="mt-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs">
                  <p className="mb-1.5 text-emerald-700 dark:text-emerald-400">
                    {note.existing
                      ? `Added. They can see “${boardName}” now.`
                      : `Invited. Task Flow doesn't email them, so send them the sign-up steps:`}
                  </p>
                  <CopyInviteButton text={inviteMessage({ email: note.email, project: boardName, existing: note.existing })} />
                </div>
              )}
              {pending.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {pending.map((address) => (
                    <li key={address} className="flex items-center gap-2 rounded-xl bg-panel-2 px-3 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">{address}</span>
                      <CopyInviteButton text={inviteMessage({ email: address, project: boardName })} label="Copy message" />
                      <button onClick={() => revoke(address)} className="rounded-full p-1 text-muted hover:text-red-500" title="Cancel invite">
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Popover>
    </>
  );
}
