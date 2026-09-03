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
  Flame,
  MicOff,
  ShieldCheck,
  Zap,
  ArrowRight,
  MousePointerClick,
  LogIn,
  Video,
} from "lucide-react";
import { GoogleIcon } from "./GoogleIcon";
import { initialDesks } from "@/lib/joindesk";

const features = [
  { icon: Target, title: "Topic Discovery", copy: "Find focused study or work spaces instantly." },
  { icon: Link2, title: "Direct Meet Access", copy: "One-click redirect to any meeting link — Meet, Zoom, Teams, and more." },
  { icon: Timer, title: "Fresh Desks", copy: "Automated 15-day desk lifespan keeps listings active." },
];

// Small, honest reasons JoinDesk feels different from a regular video call
// or a chat-based "study group" — no invented numbers, just what's true.
const whyItWorks = [
  {
    icon: MicOff,
    title: "Muted by default",
    copy: "It's silent coworking, not a hangout. Everyone stays heads-down — no small talk pressure.",
  },
  {
    icon: Flame,
    title: "Built around momentum",
    copy: "Seeing other people locked in is the nudge that keeps you from picking up your phone.",
  },
  {
    icon: ShieldCheck,
    title: "Block anytime, no drama",
    copy: "Don't vibe with someone? Block them — their desks quietly stop showing up for you.",
  },
  {
    icon: Zap,
    title: "Always fresh",
    copy: "Desks auto-expire after 15 days, so you're never joining a room that's actually dead.",
  },
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
    copy: "Sign in with your Google account and hop straight into the call — Meet, Zoom, Teams, or whatever the desk creator set up. No downloads, no extra apps.",
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
              Lock in{" "}
              <span className="bg-brand-gradient bg-clip-text text-transparent">with strangers</span>
              , online.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              JoinDesk connects you with real people for focused study or work sessions — live
              over video call, camera optional. No group chats, no small talk, no algorithm.
              Just a quiet room, a shared timer, and other people who are actually doing the work.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={onLogin}
                className="inline-flex items-center gap-3 rounded-full bg-card px-6 py-3.5 text-base font-semibold shadow-soft ring-1 ring-border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow"
              >
                <GoogleIcon />
                Continue with Google
              </button>
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2.5">
                  {initialDesks.slice(0, 4).map((d) => (
                    <img
                      key={d.id}
                      src={d.creatorAvatar}
                      alt=""
                      className="h-8 w-8 rounded-full border-2 border-background object-cover"
                    />
                  ))}
                </div>
                <p className="text-xs leading-tight text-muted-foreground">
                  Students, researchers &amp; remote
                  <br />
                  workers, focusing right now.
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              No setup, no downloads. Your desk disappears after 15 days.
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
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card/80 shadow-soft backdrop-blur-xl">
              {/* Browser-style chrome so the preview reads as "the actual app", not a mockup */}
              <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-chart-4/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                <span className="ml-3 truncate rounded-full bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  joindesk.app
                </span>
              </div>
              <div className="space-y-3 p-4 sm:p-5">
                {initialDesks.slice(0, 3).map((d, i) => (
                  <div
                    key={d.id}
                    className="rounded-2xl border border-border bg-card p-4 transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-soft"
                    style={{ marginLeft: `${i * 14}px` }}
                  >
                    <div className="flex items-center gap-3">
                      <img src={d.creatorAvatar} alt={d.creatorName} className="h-9 w-9 rounded-full object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{d.creatorName}</p>
                        <p className="text-xs text-muted-foreground">is focusing now</p>
                      </div>
                      <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
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
        </div>
      </section>

      {/* Study photo strip — pure visual flavor so the page doesn't read as
          a bare SaaS template. Real, everyday-feeling focus scenes. */}
      <section className="relative mx-auto max-w-6xl px-4 pb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&q=80",
              alt: "Student studying with headphones on, focused on a laptop",
            },
            {
              src: "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=600&q=80",
              alt: "Person taking notes beside an open laptop during a work session",
            },
            {
              src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&q=80",
              alt: "Group of people working quietly together at a shared table",
            },
            {
              src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&q=80",
              alt: "Laptop screen with a video call in progress on a desk",
            },
          ].map((img) => (
            <div
              key={img.src}
              className="aspect-[4/5] overflow-hidden rounded-2xl border border-border shadow-soft"
            >
              <img
                src={img.src}
                alt={img.alt}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
          ))}
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

      {/* Why it actually works — sets JoinDesk apart from a plain video call
          or a chat-based "study group". */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Not another group chat</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            No streaks to fake, no messages to answer. Just the quiet pressure of other people
            actually working.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {whyItWorks.map((w) => (
            <div
              key={w.title}
              className="rounded-2xl border border-border bg-card/70 p-5 text-left shadow-soft backdrop-blur transition-transform duration-200 hover:-translate-y-1"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient">
                <w.icon className="h-4.5 w-4.5 text-primary-foreground" />
              </span>
              <h3 className="mt-3 text-sm font-semibold">{w.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{w.copy}</p>
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
        <div className="relative mt-10 grid gap-6 sm:grid-cols-3">
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent sm:block"
          />
          {steps.map((s, i) => {
            const icons = [MousePointerClick, LogIn, Video];
            const StepIcon = icons[i];
            return (
              <div
                key={s.title}
                className="relative rounded-2xl border border-border bg-card p-6 shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <StepIcon className="h-4.5 w-4.5 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.copy}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="relative mx-auto max-w-6xl px-4 pb-4 sm:pb-8">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card/70 px-6 py-12 text-center shadow-soft backdrop-blur sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-aurora opacity-60 blur-2xl" />
          <div className="relative">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Stop scrolling. Start a desk.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              It takes one Google sign-in and about ten seconds. The next focused hour is up to you.
            </p>
            <button
              onClick={onLogin}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand-gradient px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-glow transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              Continue with Google
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
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
