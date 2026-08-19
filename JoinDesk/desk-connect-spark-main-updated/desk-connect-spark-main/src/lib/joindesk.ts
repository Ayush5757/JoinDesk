export type Desk = {
  id: string;
  title: string;
  description: string;
  meetLink: string;
  creatorName: string;
  creatorAvatar: string;
  createdAt: number;
  topic: string;
};

// Shape returned by the backend (GET/POST /api/desks), snake_case to match
// the Postgres columns in schema.sql.
export type DeskApiRow = {
  id: string;
  title: string;
  description: string;
  google_meet_link: string;
  creator_name: string;
  creator_avatar: string | null;
  created_at: string;
  topic: string;
};

export function deskFromApi(row: DeskApiRow): Desk {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    meetLink: row.google_meet_link,
    creatorName: row.creator_name,
    creatorAvatar: row.creator_avatar ?? "",
    createdAt: new Date(row.created_at).getTime(),
    topic: row.topic,
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
    creatorName: "Priya Nair",
    creatorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    createdAt: Date.now() - 15 * min,
    topic: "ReactJS",
  },
  {
    id: "d_2",
    title: "DSA Problem Solving & LeetCode Sprint",
    description:
      "Working through graphs and dynamic programming. We solve for 45 minutes, then discuss approaches for 10.",
    meetLink: "https://meet.google.com/dsa-focus-room",
    creatorName: "Rohan Verma",
    creatorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    createdAt: Date.now() - 42 * min,
    topic: "DSA & Coding",
  },
  {
    id: "d_3",
    title: "Linear Algebra Revision Before Finals",
    description: "Eigenvalues, vector spaces and transformations. Bring your notes and questions.",
    meetLink: "https://meet.google.com/math-revision",
    creatorName: "Sara Iqbal",
    creatorAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
    createdAt: Date.now() - 68 * min,
    topic: "Mathematics",
  },
  {
    id: "d_4",
    title: "Figma UI Polish Session — Mobile App Screens",
    description:
      "Auto-layout cleanup, spacing tokens and a shared critique at the end of the hour.",
    meetLink: "https://meet.google.com/figma-polish",
    creatorName: "Daniel Cho",
    creatorAvatar: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=150",
    createdAt: Date.now() - 5 * min,
    topic: "Design & Figma",
  },
  {
    id: "d_5",
    title: "Research Paper Reading Club — Transformers",
    description: "Quiet reading of attention-based architectures, notes shared in chat as we go.",
    meetLink: "https://meet.google.com/paper-club",
    creatorName: "Meera Joshi",
    creatorAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
    createdAt: Date.now() - 96 * min,
    topic: "Research",
  },
  {
    id: "d_6",
    title: "Frontend Interview Prep — React Patterns",
    description:
      "Mock questions on hooks, rendering and state. Focused co-working with short check-ins.",
    meetLink: "https://meet.google.com/react-interview",
    creatorName: "Alex Turner",
    creatorAvatar: "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=150",
    createdAt: Date.now() - 27 * min,
    topic: "ReactJS",
  },
];

export function relativeTime(createdAt: number) {
  const diff = Math.max(0, Date.now() - createdAt);
  const mins = Math.floor(diff / min);
  if (mins < 1) return "Created just now";
  if (mins < 60) return `Created ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `Created ${hours}h ${mins % 60}m ago`;
}
