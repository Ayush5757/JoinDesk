import { Link } from "@tanstack/react-router";
import { ChevronDown, Eye, EyeOff, LayoutGrid, Maximize2, Minimize2, Target, Video } from "lucide-react";
import type { AppUser } from "@/lib/auth";

/**
 * The top bar of the Focus Timer. It is see-through and stays out of the way:
 * it only shows when you hover the top edge of the screen (or tap the little
 * handle), and slides away again by itself. It holds the few things you may
 * want: back to JoinDesk, join a desk, hide the panels, full screen.
 */
export function FocusTopBar({
  visible,
  onShow,
  onHideSoon,
  user,
  onLogin,
  onJoin,
  onGoals,
  hud,
  onToggleHud,
  canFullscreen,
  fullscreen,
  onToggleFullscreen,
}: {
  visible: boolean;
  onShow: () => void;
  onHideSoon: () => void;
  user: AppUser | null;
  onLogin: () => void;
  onJoin: () => void;
  onGoals: () => void;
  hud: boolean;
  onToggleHud: () => void;
  canFullscreen: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const pill =
    "inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold backdrop-blur-md transition-colors hover:bg-white/20";

  return (
    <>
      {/* invisible strip along the top edge: hover it and the bar appears */}
      <div className="fixed inset-x-0 top-0 z-20 h-14" onMouseEnter={onShow} aria-hidden="true" />

      {/* a tiny handle for touch screens and as a hint that a menu lives here */}
      <button
        onClick={onShow}
        aria-label="Show menu"
        className={
          "fixed left-1/2 top-0 z-20 grid h-5 w-12 -translate-x-1/2 place-items-center rounded-b-xl bg-black/25 text-white/60 backdrop-blur-sm transition-opacity hover:text-white " +
          (visible ? "pointer-events-none opacity-0" : "opacity-60")
        }
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      <header
        onMouseEnter={onShow}
        onMouseLeave={onHideSoon}
        className={
          "fixed inset-x-0 top-0 z-30 bg-gradient-to-b from-black/55 via-black/25 to-transparent px-3 pb-6 pt-2.5 transition-all duration-300 " +
          (visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0")
        }
      >
        <div className="flex items-center gap-2">
          <Link to="/" className="flex min-w-0 items-center gap-2" title="Back to JoinDesk">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-gradient">
              <LayoutGrid className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            </span>
            <span className="truncate text-sm font-semibold tracking-tight">JoinDesk</span>
          </Link>

          <p className="ml-3 hidden text-[11px] text-white/60 md:block">
            <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-sans">G</kbd> goals ·{" "}
            <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-sans">F</kbd> full screen ·{" "}
            <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-sans">H</kbd> hide panels ·{" "}
            <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-sans">Esc</kbd> exit full screen
          </p>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={onJoin} className={pill + " bg-white text-slate-900 hover:bg-white/90"}>
              <Video className="h-3.5 w-3.5" /> Join a desk
            </button>
            <button onClick={onGoals} title="Goals, progress and reports (G)" className={pill}>
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Goals</span>
            </button>
            <button onClick={onToggleHud} title={hud ? "Hide panels (H)" : "Show panels (H)"} className={pill}>
              {hud ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="hidden sm:inline">{hud ? "Hide panels" : "Show panels"}</span>
            </button>
            {canFullscreen && (
              <button
                onClick={onToggleFullscreen}
                title={fullscreen ? "Exit full screen (F or Esc)" : "Full screen (F)"}
                className={pill}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                <span className="hidden sm:inline">{fullscreen ? "Exit full screen" : "Full screen"}</span>
              </button>
            )}
            {user ? (
              <Link
                to="/profile/$id"
                params={{ id: user.id }}
                title="Your profile"
                className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 text-xs font-bold uppercase backdrop-blur-md"
              >
                {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : user.name.slice(0, 1)}
              </Link>
            ) : (
              <button onClick={onLogin} className={pill}>
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
