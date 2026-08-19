import { Target, Link2, Timer, Sparkles } from "lucide-react";
import { GoogleIcon } from "./GoogleIcon";
import { initialDesks } from "@/lib/joindesk";

const features = [
  { icon: Target, title: "Topic Discovery", copy: "Find focused study or work spaces instantly." },
  { icon: Link2, title: "Direct Meet Access", copy: "One-click redirect to Google Meet rooms." },
  { icon: Timer, title: "Fresh Desks", copy: "Automated 3-hour desk lifespan keeps listings active." },
];

export function LandingSection({ onLogin }: { onLogin: () => void }) {
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
              Find your focus.{" "}
              <span className="bg-brand-gradient bg-clip-text text-transparent">Join a desk.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Discover virtual desks, connect via Google Meet, and get things done silently alongside
              the right people.
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
    </div>
  );
}
