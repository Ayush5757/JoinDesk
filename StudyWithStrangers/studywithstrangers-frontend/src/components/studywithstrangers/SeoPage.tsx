import { Link } from "@tanstack/react-router";
import { LayoutGrid, ArrowRight } from "lucide-react";
import { SEO_PAGES, SITE_NAME, type SeoPageData } from "@/lib/seoPages";

/**
 * A public guide page (no login). Plain, fast, server-rendered content that search engines can
 * read in full, with links to the other guides and a call to action into the app.
 */
export function SeoPage({ page }: { page: SeoPageData }) {
  const related = SEO_PAGES.filter((p) => p.slug !== page.slug);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand-gradient shadow-glow">
              <LayoutGrid className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
            </span>
            <span className="truncate text-lg font-semibold tracking-tight">{SITE_NAME}</span>
          </Link>
          <Link
            to="/"
            className="shrink-0 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Browse live desks
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">
            Home
          </Link>{" "}
          / <span>{page.label}</span>
        </nav>

        <article className="mt-4">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{page.h1}</h1>

          <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {page.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          {page.sections.map((s) => (
            <section key={s.h2} className="mt-10">
              <h2 className="text-2xl font-bold tracking-tight">{s.h2}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
              {s.bullets && (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              {s.steps && (
                <ol className="mt-3 list-decimal space-y-2 pl-5 leading-relaxed text-muted-foreground">
                  {s.steps.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ol>
              )}
            </section>
          ))}

          <section className="mt-12 rounded-3xl border border-border bg-card/80 p-6 text-center shadow-soft sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight">{page.ctaTitle}</h2>
            <p className="mt-2 text-muted-foreground">{page.ctaText}</p>
            <Link
              to="/"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 font-semibold text-primary-foreground shadow-glow"
            >
              Join a desk free <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight">Frequently asked questions</h2>
            <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card/60">
              {page.faq.map((f) => (
                <div key={f.question} className="p-5">
                  <h3 className="font-semibold">{f.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </article>

        <section className="mt-12">
          <h2 className="text-lg font-bold tracking-tight">More from {SITE_NAME}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {related.map((p) => (
              <li key={p.slug}>
                <a
                  href={p.path}
                  className="block rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-medium hover:border-primary/40 hover:shadow-soft"
                >
                  {p.label} →
                </a>
              </li>
            ))}
            <li>
              <Link
                to="/special"
                className="block rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-medium hover:border-primary/40 hover:shadow-soft"
              >
                Special desks (always open) →
              </Link>
            </li>
            <li>
              <Link
                to="/pomodoro"
                className="block rounded-xl border border-border bg-card/60 px-4 py-3 text-sm font-medium hover:border-primary/40 hover:shadow-soft"
              >
                Free Pomodoro focus timer →
              </Link>
            </li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        {SITE_NAME} — study and work with people online, free to start.
      </footer>
    </div>
  );
}
