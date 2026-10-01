export const PALETTE = [
  "#c4c4c4", "#579bfc", "#66ccff", "#00c875", "#037f4c", "#9cd326",
  "#cab641", "#fdab3d", "#ff642e", "#e2445c", "#ff7575", "#ff158a",
  "#a25ddc", "#784bd1", "#7f5347", "#333333",
];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

/** "2026-10-09" → "Oct 9" (adds the year when it isn't this year). */
export function formatDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (y !== new Date().getFullYear()) opts.year = "numeric";
  return new Date(y, m - 1, day).toLocaleDateString("en-US", opts);
}

export function todayISO() {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function isDoneName(name: string | undefined) {
  return !!name && name.trim().toLowerCase() === "done";
}
