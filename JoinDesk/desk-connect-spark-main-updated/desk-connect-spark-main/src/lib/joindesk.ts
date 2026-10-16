export type Desk = {
  id: string;
  title: string;
  description: string;
  meetLink: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  createdAt: number;
  // When the desk was last opened or reused (this is what the list is sorted by).
  activeAt: number;
  // When it stops being listed unless its creator reuses it. null = never (Special desks).
  expiresAt: number | null;
  // The field it is about: Biology, Physics, Computer Science...
  subject: string;
  topic: string;
  // true for admin-curated "Special" desks: they never expire, and the
  // creator name/avatar shown is always a generic "JoinDesk" badge.
  isSpecial: boolean;
  // true when the creator has paused/hidden this desk from the public
  // dashboard without deleting it. Only visible to the creator (and admins).
  isHidden: boolean;
};

// Shape returned by the backend (GET/POST /api/desks), snake_case to match
// the Postgres columns in schema.sql.
export type DeskApiRow = {
  id: string;
  title: string;
  description: string;
  // Not included in public desk lists any more — the link is only returned
  // by POST /api/desks/:id/join (after the access check), or to the owner/admin.
  google_meet_link?: string;
  creator_id: string;
  creator_name: string;
  creator_avatar: string | null;
  created_at: string;
  active_at?: string;
  expires_at?: string | null;
  subject?: string | null;
  topic: string;
  is_special?: boolean;
  is_hidden?: boolean;
};

export function deskFromApi(row: DeskApiRow): Desk {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    meetLink: row.google_meet_link ?? "",
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    creatorAvatar: row.creator_avatar ?? "",
    createdAt: new Date(row.created_at).getTime(),
    activeAt: new Date(row.active_at ?? row.created_at).getTime(),
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
    subject: row.subject ?? "",
    topic: row.topic,
    isSpecial: Boolean(row.is_special),
    isHidden: Boolean(row.is_hidden),
  };
}

export const topics = [
  "All Desks",
  "ReactJS",
  "DSA & Coding",
  "Mathematics",
  "Design & Figma",
  "Research",
];

const min = 60 * 1000;

export const initialDesks: Desk[] = [
  {
    id: "d_1",
    title: "ReactJS Deep Work & Component Refactoring",
    description:
      "Silently refactoring a design system into reusable components. Camera optional, focus mandatory.",
    meetLink: "https://meet.google.com/abc-defg-hij",
    creatorId: "u_1",
    creatorName: "Priya Nair",
    creatorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    createdAt: Date.now() - 15 * min,
    activeAt: Date.now() - 15 * min,
    expiresAt: null,
    subject: "ReactJS",
    topic: "ReactJS",
    isSpecial: false,
    isHidden: false,
  },
  {
    id: "d_2",
    title: "DSA Problem Solving & LeetCode Sprint",
    description:
      "Working through graphs and dynamic programming. We solve for 45 minutes, then discuss approaches for 10.",
    meetLink: "https://meet.google.com/dsa-focus-room",
    creatorId: "u_2",
    creatorName: "Rohan Verma",
    creatorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    createdAt: Date.now() - 42 * min,
    activeAt: Date.now() - 42 * min,
    expiresAt: null,
    subject: "DSA",
    topic: "DSA & Coding",
    isSpecial: false,
    isHidden: false,
  },
  {
    id: "d_3",
    title: "Linear Algebra Revision Before Finals",
    description: "Eigenvalues, vector spaces and transformations. Bring your notes and questions.",
    meetLink: "https://meet.google.com/math-revision",
    creatorId: "u_3",
    creatorName: "Sara Iqbal",
    creatorAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
    createdAt: Date.now() - 68 * min,
    activeAt: Date.now() - 68 * min,
    expiresAt: null,
    subject: "Mathematics",
    topic: "Mathematics",
    isSpecial: false,
    isHidden: false,
  },
  {
    id: "d_4",
    title: "Figma UI Polish Session — Mobile App Screens",
    description:
      "Auto-layout cleanup, spacing tokens and a shared critique at the end of the hour.",
    meetLink: "https://meet.google.com/figma-polish",
    creatorId: "u_4",
    creatorName: "Daniel Cho",
    creatorAvatar: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=150",
    createdAt: Date.now() - 5 * min,
    activeAt: Date.now() - 5 * min,
    expiresAt: null,
    subject: "Design",
    topic: "Design & Figma",
    isSpecial: false,
    isHidden: false,
  },
  {
    id: "d_5",
    title: "Research Paper Reading Club — Transformers",
    description: "Quiet reading of attention-based architectures, notes shared in chat as we go.",
    meetLink: "https://meet.google.com/paper-club",
    creatorId: "u_5",
    creatorName: "Meera Joshi",
    creatorAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
    createdAt: Date.now() - 96 * min,
    activeAt: Date.now() - 96 * min,
    expiresAt: null,
    subject: "Research",
    topic: "Research",
    isSpecial: false,
    isHidden: false,
  },
  {
    id: "d_6",
    title: "Frontend Interview Prep — React Patterns",
    description:
      "Mock questions on hooks, rendering and state. Focused co-working with short check-ins.",
    meetLink: "https://meet.google.com/react-interview",
    creatorId: "u_6",
    creatorName: "Alex Turner",
    creatorAvatar: "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=150",
    createdAt: Date.now() - 27 * min,
    activeAt: Date.now() - 27 * min,
    expiresAt: null,
    subject: "ReactJS",
    topic: "ReactJS",
    isSpecial: false,
    isHidden: false,
  },
];

function ago(ms: number) {
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / min);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** "Opened 2h 10m ago": when the desk was last opened or reused. */
export function relativeTime(activeAt: number) {
  const t = ago(activeAt);
  return t === "just now" ? "Opened just now" : `Opened ${t}`;
}

/** A normal desk whose time is up (only its creator sees it, to reuse it). */
export function isExpired(desk: Pick<Desk, "expiresAt" | "isSpecial">, now = Date.now()) {
  return !desk.isSpecial && desk.expiresAt !== null && desk.expiresAt <= now;
}

/** "Ends in 5h 20m" / "Ends in 40m" / "Expired". Empty for desks that never expire. */
export function timeLeftLabel(desk: Pick<Desk, "expiresAt" | "isSpecial">, now = Date.now()) {
  if (desk.isSpecial || desk.expiresAt === null) return "";
  const left = desk.expiresAt - now;
  if (left <= 0) return "Expired";
  const mins = Math.max(1, Math.floor(left / min));
  const hours = Math.floor(mins / 60);
  if (hours < 1) return `Ends in ${mins}m`;
  return `Ends in ${hours}h ${mins % 60}m`;
}
