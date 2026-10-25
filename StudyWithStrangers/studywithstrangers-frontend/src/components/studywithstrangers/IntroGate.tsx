import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Check, Loader2, Play, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { AUTH_CHANGED_EVENT } from "@/lib/auth";
import { fetchIntroSeenVersion, postIntroSeen, useSiteMedia } from "@/lib/siteMedia";
import { SEO_PAGES } from "@/lib/seoPages";
import { parseYouTubeId } from "@/lib/video";

// Search engines and link-preview bots must always get the real page, never a pop-up.
const BOT_RE = /bot|crawl|spider|slurp|lighthouse|headless|pagespeed|facebookexternalhit|whatsapp|telegram|preview/i;

// Public guide pages and the admin panel are left alone; the video appears on the app itself.
const SKIP_PATHS = ["/admin", ...SEO_PAGES.map((p) => p.path)];

/**
 * The welcome video every new account has to watch once, right after signing in.
 * - Cannot be closed, skipped, rewound-forward or muted (sound is forced on; seeking ahead snaps back).
 * - The "OK" button unlocks only when the video has played to the end.
 * - "Watched" is saved on the ACCOUNT in the database, so it never repeats on another phone or laptop. Replacing
 *   the video does not bring it back for anyone, unless the admin ticks "make everyone watch it again"
 *   (Admin Panel -> Videos), which raises the version number.
 * - Visitors who are not signed in are not interrupted (they can't use the app yet anyway).
 */
export function IntroGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { media } = useSiteMedia();
  const [isBot, setIsBot] = useState(true); // assume "bot" until we are on the client
  // The version of the video this account has finished. null = not signed in / unknown (never blocks anyone).
  const [seenVersion, setSeenVersion] = useState<number | null>(null);

  useEffect(() => {
    setIsBot(BOT_RE.test(navigator.userAgent));
  }, []);

  // Ask the server who is signed in now, on load and again right after a sign-in or sign-out.
  useEffect(() => {
    let alive = true;
    const check = () => {
      void fetchIntroSeenVersion().then((v) => {
        if (alive) setSeenVersion(v);
      });
    };
    check();
    window.addEventListener(AUTH_CHANGED_EVENT, check);
    return () => {
      alive = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, check);
    };
  }, []);

  const intro = media?.intro;
  const skipPage = SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const mustWatch = Boolean(intro) && seenVersion !== null && seenVersion < (intro?.version ?? 0) && !isBot && !skipPage;

  useEffect(() => {
    if (!mustWatch) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mustWatch]);

  if (!mustWatch || !intro) return null;

  return (
    <IntroPlayer
      key={`${intro.url}-${intro.version}`}
      url={intro.url}
      onFinished={async () => {
        // Close right away; saving happens in the background so a slow server never traps the user.
        setSeenVersion(intro.version);
        try {
          await postIntroSeen();
        } catch {
          toast.error("Couldn't save that you watched the video, so it may show again next time.");
        }
      }}
      // If the video itself is broken we must not lock people out of the site; they just see it next time.
      onGiveUp={() => setSeenVersion(intro.version)}
    />
  );
}

type AreaProps = {
  onProgress: (pct: number) => void;
  onEnded: () => void;
  onGiveUp: () => void;
};

/** The card around the video: title, progress, volume hint and the locked OK button. */
function IntroPlayer({ url, onFinished, onGiveUp }: { url: string; onFinished: () => void; onGiveUp: () => void }) {
  const [pct, setPct] = useState(0);
  const [ended, setEnded] = useState(false);
  const ytId = parseYouTubeId(url);

  const handleEnded = () => {
    setPct(100);
    setEnded(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome video"
      className="fixed inset-0 z-[200] overflow-y-auto bg-black/90 backdrop-blur-md"
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-4xl rounded-3xl border border-border bg-card p-4 shadow-glow sm:p-6">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Welcome to StudyWithStrangers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Please watch this short video first. It shows you how the site works. The button below unlocks
            when the video finishes.
          </p>

          {ytId ? (
            <YouTubeArea videoId={ytId} onProgress={setPct} onEnded={handleEnded} onGiveUp={onGiveUp} />
          ) : (
            <FileArea url={url} onProgress={setPct} onEnded={handleEnded} onGiveUp={onGiveUp} />
          )}

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Volume2 className="h-3.5 w-3.5" /> Sound is on. Turn up your volume to hear it.
          </p>

          <button
            onClick={onFinished}
            disabled={!ended}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform enabled:hover:scale-[1.01] enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
          >
            {ended ? (
              <>
                <Check className="h-4 w-4" /> OK, take me to the site
              </>
            ) : (
              `Watch the full video to continue${pct > 0 ? ` (${pct}%)` : ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ pct, width }: { pct: number; width: string }) {
  return (
    <div className="mx-auto mt-3 h-1.5 overflow-hidden rounded-full bg-muted" style={{ width }}>
      <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ErrorOverlay({ errors, onRetry, onGiveUp }: { errors: number; onRetry: () => void; onGiveUp: () => void }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-black/80 p-4 text-center text-white">
      <div>
        <p className="text-sm font-semibold">The video couldn't load.</p>
        <p className="mt-1 text-xs text-white/70">Check your internet connection and try again.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button onClick={onRetry} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black">
            Try again
          </button>
          {errors >= 2 && (
            <button
              onClick={onGiveUp}
              className="rounded-full border border-white/40 px-4 py-2 text-xs font-semibold text-white"
            >
              Continue for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- MP4 / WebM file
function FileArea({ url, onProgress, onEnded, onGiveUp }: AreaProps & { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxTime = useRef(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [pct, setPct] = useState(0);
  const [ratio, setRatio] = useState(16 / 9);
  const [waiting, setWaiting] = useState(false);
  const [errors, setErrors] = useState(0);
  const [blocked, setBlocked] = useState(false);

  // Pause when the person leaves the tab so the video can't "play" while they do something else.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) videoRef.current?.pause();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const start = async () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false; // starting from a tap is what lets the browser play WITH sound
    v.volume = 1;
    try {
      await v.play();
      setStarted(true);
      setBlocked(false);
    } catch {
      setBlocked(true);
    }
  };

  const togglePause = () => {
    const v = videoRef.current;
    if (!v || !started || ended) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const failed = errors > 0;
  const width = `min(100%, calc(65vh * ${ratio}))`;

  return (
    <>
      <div className="relative mx-auto mt-4 overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: String(ratio), width }}>
        <video
          ref={videoRef}
          src={url}
          className="h-full w-full object-contain"
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload noplaybackrate noremoteplayback"
          onContextMenu={(e) => e.preventDefault()}
          onClick={togglePause}
          onLoadedMetadata={(e) => {
            const { videoWidth: w, videoHeight: h } = e.currentTarget;
            if (w && h) setRatio(w / h);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            // Only count normal forward play; a jump ahead is undone in onSeeking.
            if (v.currentTime - maxTime.current < 1.5) maxTime.current = Math.max(maxTime.current, v.currentTime);
            if (v.duration) {
              const p = Math.min(100, Math.round((maxTime.current / v.duration) * 100));
              setPct(p);
              onProgress(p);
            }
          }}
          onSeeking={(e) => {
            const v = e.currentTarget;
            if (v.currentTime > maxTime.current + 1) v.currentTime = maxTime.current; // no skipping ahead
          }}
          onRateChange={(e) => {
            e.currentTarget.playbackRate = 1; // no speeding through it
          }}
          onVolumeChange={(e) => {
            const v = e.currentTarget;
            if (v.muted) v.muted = false; // sound stays on
            if (v.volume === 0) v.volume = 1;
          }}
          onEnded={() => {
            setPct(100);
            setEnded(true);
            onEnded();
          }}
          onError={() => setErrors((n) => n + 1)}
        />

        {!started && !failed && (
          <button
            onClick={start}
            className="absolute inset-0 grid place-items-center bg-black/55 text-white"
            aria-label="Play the video"
          >
            <span className="flex flex-col items-center gap-3">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-gradient shadow-glow sm:h-20 sm:w-20">
                <Play className="h-7 w-7 translate-x-0.5 fill-current sm:h-9 sm:w-9" />
              </span>
              <span className="text-sm font-semibold sm:text-base">
                {blocked ? "Tap again to play" : "Tap to play with sound"}
              </span>
            </span>
          </button>
        )}

        {started && !playing && !ended && !failed && (
          <button
            onClick={togglePause}
            className="absolute inset-0 grid place-items-center bg-black/40 text-white"
            aria-label="Resume the video"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/20 backdrop-blur">
              <Play className="h-6 w-6 translate-x-0.5 fill-current" />
            </span>
          </button>
        )}

        {started && waiting && playing && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/80" />
          </div>
        )}

        {failed && (
          <ErrorOverlay
            errors={errors}
            onRetry={() => {
              setErrors(0);
              videoRef.current?.load();
            }}
            onGiveUp={onGiveUp}
          />
        )}
      </div>
      <ProgressBar pct={pct} width={width} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------- YouTube
// Loaded once, only when a YouTube welcome video is actually shown.
let ytApi: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (ytApi) return ytApi;
  ytApi = new Promise((resolve, reject) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => {
      ytApi = null;
      reject(new Error("YouTube player didn't load"));
    };
    document.head.appendChild(tag);
  });
  return ytApi;
}

/**
 * YouTube plays the video (free, no bandwidth limit), but we draw our own tap-blocking layer on top of it:
 * no YouTube controls, titles or links can be clicked, and a timer snaps the video back if the time jumps ahead,
 * un-mutes it, and resets any speed change.
 */
function YouTubeArea({ videoId, onProgress, onEnded, onGiveUp }: AreaProps & { videoId: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const maxTime = useRef(0);
  const endedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [pct, setPct] = useState(0);
  const [errors, setErrors] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // Build the player.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !mountRef.current) return;
        // YouTube replaces this element with its iframe, so give it a fresh one each time.
        const host = document.createElement("div");
        mountRef.current.innerHTML = "";
        mountRef.current.appendChild(host);

        playerRef.current = new YT.Player(host, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: () => !cancelled && setReady(true),
            onError: () => !cancelled && setErrors((n) => n + 1),
            onStateChange: (e: { data: number }) => {
              if (cancelled) return;
              if (e.data === 1) setPlaying(true); // playing
              if (e.data === 2) setPlaying(false); // paused
              if (e.data === 0 && !endedRef.current) {
                endedRef.current = true;
                setPlaying(false);
                setEnded(true);
                setPct(100);
                onEnded();
              }
            },
          },
        });

        // Watch over the player twice a second.
        timer = window.setInterval(() => {
          const p = playerRef.current;
          if (!p?.getCurrentTime || endedRef.current) return;
          try {
            if (p.isMuted?.()) p.unMute();
            if (p.getPlaybackRate?.() !== 1) p.setPlaybackRate(1);
            const t = p.getCurrentTime();
            if (t - maxTime.current > 1.5) {
              p.seekTo(maxTime.current, true); // jumped ahead: put it back
            } else {
              maxTime.current = Math.max(maxTime.current, t);
            }
            const d = p.getDuration?.();
            if (d > 0) {
              const v = Math.min(99, Math.round((maxTime.current / d) * 100));
              setPct(v);
              onProgress(v);
            }
          } catch {
            /* the player is still starting */
          }
        }, 500);
      })
      .catch(() => !cancelled && setErrors((n) => n + 1));

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* nothing to clean up */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, attempt]);

  // Pause when the person leaves the tab.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) playerRef.current?.pauseVideo?.();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const start = () => {
    const p = playerRef.current;
    if (!p?.playVideo) return;
    p.unMute?.(); // from a tap, so the browser allows sound
    p.setVolume?.(100);
    p.playVideo();
    setStarted(true);
  };

  const togglePause = () => {
    const p = playerRef.current;
    if (!p || !started || ended) return;
    if (p.getPlayerState?.() === 1) p.pauseVideo();
    else p.playVideo();
  };

  const failed = errors > 0;

  return (
    <>
      <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <div ref={mountRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />

        {/* Covers the player so nothing inside it can be tapped. */}
        {!failed && !ended && (
          <button
            className="absolute inset-0 z-[5] grid place-items-center text-white"
            onClick={started ? togglePause : start}
            disabled={!ready}
            aria-label={started ? (playing ? "Pause" : "Resume") : "Play the video"}
          >
            {!started ? (
              <span className="grid h-full w-full place-items-center bg-black/55">
                {ready ? (
                  <span className="flex flex-col items-center gap-3">
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-gradient shadow-glow sm:h-20 sm:w-20">
                      <Play className="h-7 w-7 translate-x-0.5 fill-current sm:h-9 sm:w-9" />
                    </span>
                    <span className="text-sm font-semibold sm:text-base">Tap to play with sound</span>
                  </span>
                ) : (
                  <Loader2 className="h-8 w-8 animate-spin text-white/80" />
                )}
              </span>
            ) : !playing ? (
              <span className="grid h-full w-full place-items-center bg-black/40">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-white/20 backdrop-blur">
                  <Play className="h-6 w-6 translate-x-0.5 fill-current" />
                </span>
              </span>
            ) : null}
          </button>
        )}

        {/* Hides YouTube's "more videos" end screen. */}
        {ended && (
          <div className="absolute inset-0 z-[5] grid place-items-center bg-black text-white">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Check className="h-5 w-5" /> You've watched the whole video
            </span>
          </div>
        )}

        {failed && (
          <ErrorOverlay
            errors={errors}
            onRetry={() => {
              setErrors(0);
              setReady(false);
              setStarted(false);
              setAttempt((n) => n + 1);
            }}
            onGiveUp={onGiveUp}
          />
        )}
      </div>
      <ProgressBar pct={pct} width="100%" />
    </>
  );
}
