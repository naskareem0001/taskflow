export type Role = "admin" | "member";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  color: string;
  role: Role;
  created_at: string;
}

/** A status, stage or project category: editable, colored, ordered lists. */
export interface Option {
  id: string;
  name: string;
  color: string;
  position: number;
  /** Stages only: the project category this stage belongs to. */
  category_id?: string | null;
}

export interface Board {
  id: string;
  name: string;
  /** Brand logo as a small data URL, or null. */
  logo: string | null;
  /** Project category; decides which stages the board offers. */
  category_id?: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
}

export type ApprovalState = "none" | "pending" | "approved" | "changes";
export type ApprovalAction = "requested" | "approved" | "changes";

export interface Task {
  id: string;
  board_id: string;
  parent_id: string | null;
  title: string;
  requestor_id: string | null;
  owner_id: string | null;
  due_date: string | null;
  status_id: string | null;
  stage_id: string | null;
  approval: ApprovalState;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalEvent {
  id: string;
  task_id: string;
  action: ApprovalAction;
  note: string;
  actor_id: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  mentions: string[];
  /** The update this one replies to, if any. */
  reply_to?: string | null;
  created_at: string;
}

export type NotifKind =
  | "assigned"
  | "mention"
  | "approval_requested"
  | "approval_approved"
  | "approval_changes";

export interface Notif {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: NotifKind;
  task_id: string | null;
  body: string;
  read: boolean;
  created_at: string;
  task: { id: string; board_id: string; title: string } | null;
}
