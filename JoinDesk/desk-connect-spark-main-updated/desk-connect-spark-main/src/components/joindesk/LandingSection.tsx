import { useState } from "react";
import {
  Target,
  Link2,
  Timer,
  Sparkles,
  GraduationCap,
  Microscope,
  Plane,
  Briefcase,
  Palette,
  ChevronDown,
} from "lucide-react";
import { GoogleIcon } from "./GoogleIcon";
import { initialDesks } from "@/lib/joindesk";

const features = [
  { icon: Target, title: "Topic Discovery", copy: "Find focused study or work spaces instantly." },
  { icon: Link2, title: "Direct Meet Access", copy: "One-click redirect to Google Meet rooms." },
  { icon: Timer, title: "Fresh Desks", copy: "Automated 3-hour desk lifespan keeps listings active." },
];

// Who actually shows up looking for a desk — kept specific on purpose so it
// reads naturally for both humans and search engines.
const personas = [
  {
    icon: GraduationCap,
    title: "Students",
    copy: "Prepping for exams or grinding through assignments? Join a study room with strangers who are heads-down too.",
  },
  {
    icon: Microscope,
    title: "Researchers",
    copy: "Working through papers or data alone gets lonely. Sit in on a desk with other researchers and stay in flow.",
  },
  {
    icon: Plane,
    title: "Travelers",
    copy: "Working or studying from a new city? Find people online to focus alongside, wherever you've landed.",
  },
  {
    icon: Briefcase,
    title: "Remote professionals",
    copy: "Need an accountability partner for deep work? Join a silent coworking desk and get through your task list.",
  },
  {
    icon: Palette,
    title: "Hobbyists & creators",
    copy: "Writing, coding a side project, learning a language — find strangers with the same kind of focus session.",
  },
];

const steps = [
  {
    title: "Pick a desk",
    copy: "Browse live desks by topic — DSA, research, writing, exam prep, and more — and see who's already focusing.",
  },
  {
    title: "Join with Google",
    copy: "Sign in with your Google account and hop straight into the Google Meet call. No downloads, no extra apps.",
  },
  {
    title: "Study or work, together",
    copy: "Everyone stays on mute and focused — it's silent coworking, not a chat room. Just company while you get things done.",
  },
];

type FaqItem = { question: string; answer: string };

export function LandingSection({
  onLogin,
  faqItems,
}: {
  onLogin: () => void;
  faqItems: FaqItem[];
}) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-aurora blur-3xl" />
      <section className="relative mx-auto max-w-6xl px-4 pt-16 pb-10 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Silent co-working, on demand
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
              Study and work{" "}
              <span className="bg-brand-gradient bg-clip-text text-transparent">with strangers</span>
              , online.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              JoinDesk connects you with real people online for focused study or work sessions —
              live over Google Meet. Find a study partner, a research buddy, or just quiet company
              to get things done, whether you're a student, a researcher, a traveler, or a remote
              professional.
            </p>
            <button
              onClick={onLogin}
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-card px-6 py-3.5 text-base font-semibold shadow-soft ring-1 ring-border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              No setup. Your desk disappears after 3 hours.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border bg-card/70 p-4 shadow-soft backdrop-blur transition-transform duration-200 hover:-translate-y-1"
                >
                  <f.icon className="h-5 w-5 text-primary" />
                  <p className="mt-2.5 text-sm font-semibold">{f.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -m-6 rounded-[2.5rem] bg-aurora opacity-70 blur-2xl" />
            <div className="relative space-y-4">
              {initialDesks.slice(0, 3).map((d, i) => (
                <div
                  key={d.id}
                  className="rounded-3xl border border-border bg-card/80 p-5 shadow-soft backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1"
                  style={{ marginLeft: `${i * 18}px` }}
                >
                  <div className="flex items-center gap-3">
                    <img src={d.creatorAvatar} alt={d.creatorName} className="h-9 w-9 rounded-full object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{d.creatorName}</p>
                      <p className="text-xs text-muted-foreground">is focusing now</p>
                    </div>
                    <span className="ml-auto flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                      Live
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug">{d.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for — deliberately specific so people searching for their
          own use case (student, researcher, traveler...) land here. */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Built for anyone who focuses better with people around
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Whatever you're working on, chances are someone else online is doing something similar
            right now. JoinDesk is where you find them.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {personas.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-border bg-card/70 p-5 text-left shadow-soft backdrop-blur transition-transform duration-200 hover:-translate-y-1"
            >
              <p.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How JoinDesk works</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Three steps between you and a focused work session with real people.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-border bg-card/70 p-6 shadow-soft backdrop-blur">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="mt-4 text-sm font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — visible text mirrors the FAQPage structured data in index.tsx */}
      <section className="relative mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Frequently asked questions
        </h2>
        <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card/70 shadow-soft backdrop-blur">
          {faqItems.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={item.question}>
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold">{item.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
