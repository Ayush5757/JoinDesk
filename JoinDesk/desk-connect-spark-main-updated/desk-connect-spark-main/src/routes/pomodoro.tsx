import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Play,
  Pause,
  RotateCcw,
  Image as ImageIcon,
  Music2,
  Volume2,
  VolumeX,
  SkipForward,
  Pin,
  PinOff,
  Search,
  Video,
  X,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/joindesk/Navbar";
import { BlockedScreen } from "@/components/joindesk/BlockedScreen";
import { JoinDeskModal } from "@/components/joindesk/JoinDeskModal";
import { loginWithGoogle, logout, restoreSession, BlockedError, type AppUser } from "@/lib/auth";
import { searchDesksFull } from "@/lib/desks";
import type { Desk } from "@/lib/joindesk";

export const Route = createFileRoute("/pomodoro")({
  head: () => ({ meta: [{ title: "Focus Timer — JoinDesk" }] }),
  component: PomodoroPage,
});

// =========================================================================
// Study wallpapers — auto-changing, no API key needed
// =========================================================================
// Openverse (api.openverse.org) is a free, key-free search over openly
// licensed photos. We rotate through calm/"study vibe" search terms so the
// background always feels relaxing and on-theme, never random junk.
const WALLPAPER_QUERIES = [
  "cozy study desk sunlight",
  "peaceful library aesthetic",
  "calm mountain sunrise",
  "quiet forest path",
  "aesthetic coffee shop study",
  "plants sunlight cozy room",
  "calm lake reflection",
  "soft pastel sky clouds",
  "minimal desk workspace plants",
  "quiet beach morning calm",
];

const WALLPAPER_REFRESH_MS = 15 * 60 * 1000; // "har 15 min mai change"
const WALLPAPER_STORAGE_KEY = "joindesk_pomodoro_permanent_wallpaper";

// A soft, no-network-needed gradient so the page never looks broken if the
// wallpaper fetch fails (offline, blocked, etc.) — always something calm.
const FALLBACK_GRADIENT =
  "linear-gradient(135deg, #1e293b 0%, #334155 45%, #1e3a3a 100%)";

function useStudyWallpaper() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isPermanent, setIsPermanent] = useState(false);
  const [loading, setLoading] = useState(true);
  const isPermanentRef = useRef(false);

  const fetchRandomWallpaper = async () => {
    try {
      const term =
        WALLPAPER_QUERIES[Math.floor(Math.random() * WALLPAPER_QUERIES.length)] ??
        WALLPAPER_QUERIES[0];
      const res = await fetch(
        `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
          term as string
        )}&license_type=commercial,modification&mature=false&page_size=20`
      );
      if (!res.ok) throw new Error("wallpaper fetch failed");
      const data = await res.json();
      const results: Array<{ url?: string }> = Array.isArray(data?.results) ? data.results : [];
      const withUrls = results.filter((r) => Boolean(r.url));
      if (!withUrls.length) throw new Error("no wallpaper results");
      const pick = withUrls[Math.floor(Math.random() * withUrls.length)];
      if (pick?.url) setImageUrl(pick.url);
    } catch {
      // Silent — the fallback gradient keeps the page looking good.
    } finally {
      setLoading(false);
    }
  };

  // Load once on mount: either the saved permanent wallpaper, or a fresh
  // random one. Then keep rotating every 15 minutes unless permanent.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WALLPAPER_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { url: string };
        if (saved?.url) {
          setImageUrl(saved.url);
          setIsPermanent(true);
          isPermanentRef.current = true;
          setLoading(false);
        }
      }
    } catch {
      // Corrupt/old value — ignore and fall through to fetching fresh.
    }
    if (!isPermanentRef.current) fetchRandomWallpaper();

    const id = window.setInterval(() => {
      if (!isPermanentRef.current) fetchRandomWallpaper();
    }, WALLPAPER_REFRESH_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPermanent = () => {
    if (!imageUrl) return;
    try {
      localStorage.setItem(WALLPAPER_STORAGE_KEY, JSON.stringify({ url: imageUrl }));
    } catch {
      // localStorage can fail in private/incognito modes — not fatal.
    }
    isPermanentRef.current = true;
    setIsPermanent(true);
    toast.success("This wallpaper is set — it'll stay until you remove it.");
  };

  const removePermanent = () => {
    try {
      localStorage.removeItem(WALLPAPER_STORAGE_KEY);
    } catch {
      // ignore
    }
    isPermanentRef.current = false;
    setIsPermanent(false);
    fetchRandomWallpaper();
    toast.success("Back to auto-changing wallpapers.");
  };

  const skipToNext = () => {
    if (isPermanentRef.current) return;
    setLoading(true);
    fetchRandomWallpaper();
  };

  return { imageUrl, isPermanent, loading, setPermanent, removePermanent, skipToNext };
}

// =========================================================================
// Ambient study music — synthesized in the browser, so it always works,
// never has words/lyrics (nothing to distract you), and never depends on
// any external music API or key. Three smooth, low-tone presets that cycle
// automatically, or on demand with "Next".
// =========================================================================
type MusicPreset = "pad" | "rain" | "chimes";
const MUSIC_PRESETS: { id: MusicPreset; label: string }[] = [
  { id: "pad", label: "Soft Pad" },
  { id: "rain", label: "Rainy Focus" },
  { id: "chimes", label: "Gentle Chimes" },
];
const MUSIC_AUTO_CHANGE_MS = 15 * 60 * 1000;

// Safe accessor — presetIndex is always kept in range via modulo, but
// TypeScript's noUncheckedIndexedAccess doesn't know that, so this keeps
// every call site simple instead of repeating `?? MUSIC_PRESETS[0]!` everywhere.
function getMusicPreset(index: number) {
  return MUSIC_PRESETS[index % MUSIC_PRESETS.length] ?? MUSIC_PRESETS[0]!;
}

function useAmbientMusic() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const stopCurrentRef = useRef<() => void>(() => {});
  const [presetIndex, setPresetIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [muted, setMuted] = useState(false);

  const ensureContext = () => {
    if (!ctxRef.current) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.gain.value = muted ? 0 : volume;
      gain.connect(ctx.destination);
      ctxRef.current = ctx;
      masterGainRef.current = gain;
    }
    return { ctx: ctxRef.current!, master: masterGainRef.current! };
  };

  const startPreset = (preset: MusicPreset) => {
    const { ctx, master } = ensureContext();
    stopCurrentRef.current();
    const stoppers: Array<() => void> = [];

    if (preset === "pad") {
      // A slow, softly detuned chord — smooth, wordless background hum.
      const freqs = [130.81, 164.81, 196.0]; // C3, E3, G3
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.0001;
        osc.connect(oscGain).connect(master);
        osc.start();
        oscGain.gain.linearRampToValueAtTime(0.16 / freqs.length, ctx.currentTime + 2.5);

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.04 + i * 0.015;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 1.5;
        lfo.connect(lfoGain).connect(osc.frequency);
        lfo.start();

        stoppers.push(() => {
          try {
            osc.stop();
            lfo.stop();
          } catch {
            /* already stopped */
          }
        });
      });
    } else if (preset === "rain") {
      // Filtered brown noise — a soft, steady "rain" wash, no words at all.
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const value = (lastOut + 0.02 * white) / 1.02;
        lastOut = value;
        data[i] = value * 3.2;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 850;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      src.connect(filter).connect(g).connect(master);
      src.start();
      g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 2);
      stoppers.push(() => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      });
    } else {
      // A quiet drone plus occasional soft plucked notes (pentatonic —
      // always sounds pleasant, never jarring, still no words).
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 196.0;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.0001;
      osc.connect(oscGain).connect(master);
      osc.start();
      oscGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 2);

      const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
      let timeoutId = 0;
      const pluck = () => {
        const f = scale[Math.floor(Math.random() * scale.length)] ?? 523.25;
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0;
        o.connect(g).connect(master);
        o.start();
        const t = ctx.currentTime;
        g.gain.linearRampToValueAtTime(0.11, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
        o.stop(t + 3.2);
        timeoutId = window.setTimeout(pluck, 2500 + Math.random() * 3500);
      };
      pluck();
      stoppers.push(() => {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
        window.clearTimeout(timeoutId);
      });
    }

    stopCurrentRef.current = () => stoppers.forEach((stop) => stop());
  };

  useEffect(() => {
    if (masterGainRef.current && ctxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        muted ? 0 : volume,
        ctxRef.current.currentTime,
        0.05
      );
    }
  }, [volume, muted]);

  const play = () => {
    const { ctx } = ensureContext();
    if (ctx.state === "suspended") ctx.resume();
    startPreset(getMusicPreset(presetIndex).id);
    setPlaying(true);
  };
  const pause = () => {
    stopCurrentRef.current();
    setPlaying(false);
  };
  const next = () => {
    const nextIndex = (presetIndex + 1) % MUSIC_PRESETS.length;
    setPresetIndex(nextIndex);
    if (playing) startPreset(getMusicPreset(nextIndex).id);
  };

  // Auto-change preset every 15 min while playing, so it's never on a loop
  // for too long — resets whenever you switch presets manually too.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(next, MUSIC_AUTO_CHANGE_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, presetIndex]);

  useEffect(() => () => stopCurrentRef.current(), []);

  return {
    playing,
    play,
    pause,
    next,
    label: getMusicPreset(presetIndex).label,
    volume,
    setVolume: setVolumeState,
    muted,
    setMuted,
  };
}

// =========================================================================
// The timer itself — simple presets, work/break/long-break cycle.
// =========================================================================
type Phase = "work" | "break" | "longBreak";
type PresetKey = "classic" | "deep" | "sprint";
const TIMER_PRESETS: Record<PresetKey, { label: string; work: number; short: number; long: number }> = {
  classic: { label: "Classic 25/5", work: 25, short: 5, long: 15 },
  deep: { label: "Deep Work 50/10", work: 50, short: 10, long: 20 },
  sprint: { label: "Short Sprint 15/5", work: 15, short: 5, long: 15 },
};

function phaseLabel(phase: Phase) {
  if (phase === "work") return "Study Time";
  if (phase === "break") return "Short Break";
  return "Long Break";
}

// A short two-tone chime when a phase ends — plain and simple, not music.
function playChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(ctx.destination);
      const start = ctx.currentTime + i * 0.18;
      osc.start(start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.stop(start + 0.5);
    });
    window.setTimeout(() => ctx.close(), 1200);
  } catch {
    // Some browsers block audio before a user gesture — not worth erroring over.
  }
}

function usePomodoroTimer() {
  const [presetKey, setPresetKeyState] = useState<PresetKey>("classic");
  const [phase, setPhase] = useState<Phase>("work");
  const [secondsLeft, setSecondsLeft] = useState(TIMER_PRESETS.classic.work * 60);
  const [running, setRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);

  const phaseRef = useRef<Phase>("work");
  const completedRef = useRef(0);
  const presetRef = useRef(TIMER_PRESETS.classic);

  const phaseSeconds = (p: Phase, preset = presetRef.current) =>
    (p === "work" ? preset.work : p === "break" ? preset.short : preset.long) * 60;

  const setPresetKey = (key: PresetKey) => {
    presetRef.current = TIMER_PRESETS[key];
    setPresetKeyState(key);
    phaseRef.current = "work";
    completedRef.current = 0;
    setPhase("work");
    setCompletedSessions(0);
    setSecondsLeft(phaseSeconds("work", TIMER_PRESETS[key]));
    setRunning(false);
  };

  const resetTimer = () => setPresetKey(presetKey);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;

        if (phaseRef.current === "work") completedRef.current += 1;
        const next: Phase =
          phaseRef.current === "work"
            ? completedRef.current % 4 === 0
              ? "longBreak"
              : "break"
            : "work";
        phaseRef.current = next;
        setPhase(next);
        setCompletedSessions(completedRef.current);
        playChime();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(phaseLabel(next), {
            body: next === "work" ? "Break's over — back to studying!" : "Nice work — take a break.",
          });
        }
        return phaseSeconds(next);
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Keep the browser tab title showing the countdown, so this can sit in
  // its own background tab while a call runs in another tab.
  useEffect(() => {
    if (!running) {
      document.title = "Focus Timer — JoinDesk";
      return;
    }
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const ss = String(secondsLeft % 60).padStart(2, "0");
    document.title = `${mm}:${ss} · ${phaseLabel(phase)}`;
  }, [secondsLeft, running, phase]);

  return {
    presetKey,
    setPresetKey,
    phase,
    secondsLeft,
    running,
    start: () => setRunning(true),
    pause: () => setRunning(false),
    resetTimer,
    completedSessions,
  };
}

function formatTime(totalSeconds: number) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// =========================================================================
// The page
// =========================================================================
function PomodoroPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    restoreSession()
      .then(setUser)
      .catch((err) => {
        if (err instanceof BlockedError) setIsBlocked(true);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const wallpaper = useStudyWallpaper();
  const music = useAmbientMusic();
  const timer = usePomodoroTimer();
  const [joinPanelOpen, setJoinPanelOpen] = useState(false);

  const handleLogin = async () => {
    try {
      setUser(await loginWithGoogle());
    } catch (err) {
      if (err instanceof BlockedError) setIsBlocked(true);
    }
  };
  const handleLogout = () => {
    logout();
    setUser(null);
  };

  if (checkingSession) return <div className="min-h-screen bg-background" />;
  if (isBlocked) return <BlockedScreen />;

  return (
    <div className="relative min-h-screen text-white">
      {/* Full-page background wallpaper, with a dark overlay so text stays readable no matter the photo. */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center transition-[background-image] duration-700"
        style={{
          backgroundImage: wallpaper.imageUrl ? `url(${wallpaper.imageUrl})` : FALLBACK_GRADIENT,
        }}
      />
      <div className="fixed inset-0 -z-10 bg-black/55" />

      <Navbar
        isLoggedIn={Boolean(user)}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        searchQuery=""
        onSearchChange={() => {}}
        onCreate={() => {}}
        hideSearch
        hideCreate
      />

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-10 sm:py-16">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Focus Timer</h1>
        <p className="mt-1.5 text-center text-sm text-white/70">
          A quiet space to study. Keep this tab open — join a call in a new tab and this timer
          keeps running right here.
        </p>

        {/* ------------------------------- Timer card ------------------------------- */}
        <div className="mt-8 w-full rounded-3xl border border-white/15 bg-white/10 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="inline-flex rounded-full border border-white/20 bg-black/20 p-1 text-xs font-semibold">
            {(Object.keys(TIMER_PRESETS) as PresetKey[]).map((key) => (
              <button
                key={key}
                onClick={() => timer.setPresetKey(key)}
                className={
                  "rounded-full px-3 py-1.5 transition-colors " +
                  (timer.presetKey === key ? "bg-white text-slate-900" : "text-white/70 hover:text-white")
                }
              >
                {TIMER_PRESETS[key].label}
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-white/70">
            {phaseLabel(timer.phase)}
          </p>
          <p className="mt-2 font-mono text-6xl font-bold tabular-nums sm:text-7xl">
            {formatTime(timer.secondsLeft)}
          </p>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                className={
                  "h-1.5 w-6 rounded-full transition-colors " +
                  (i < timer.completedSessions % 4 || (timer.completedSessions > 0 && timer.completedSessions % 4 === 0 && i < 4)
                    ? "bg-white"
                    : "bg-white/25")
                }
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-white/60">
            {timer.completedSessions} study session{timer.completedSessions === 1 ? "" : "s"} completed
          </p>

          <div className="mt-7 flex items-center justify-center gap-3">
            {timer.running ? (
              <button
                onClick={timer.pause}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-lg transition-transform hover:scale-105"
              >
                <Pause className="h-4 w-4" /> Pause
              </button>
            ) : (
              <button
                onClick={timer.start}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-lg transition-transform hover:scale-105"
              >
                <Play className="h-4 w-4" /> Start
              </button>
            )}
            <button
              onClick={timer.resetTimer}
              title="Reset"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10 transition-colors hover:bg-white/20"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ------------------------------- Wallpaper + Music controls ------------------------------- */}
        <div className="mt-5 grid w-full gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ImageIcon className="h-4 w-4" /> Study Wallpaper
            </div>
            <p className="mt-1 text-xs text-white/65">
              {wallpaper.isPermanent
                ? "This wallpaper is set as yours."
                : "Changes automatically every 15 minutes."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!wallpaper.isPermanent && (
                <button
                  onClick={wallpaper.skipToNext}
                  disabled={wallpaper.loading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/20 disabled:opacity-50"
                >
                  <SkipForward className="h-3.5 w-3.5" /> New wallpaper
                </button>
              )}
              {wallpaper.isPermanent ? (
                <button
                  onClick={wallpaper.removePermanent}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/20"
                >
                  <PinOff className="h-3.5 w-3.5" /> Remove my wallpaper
                </button>
              ) : (
                <button
                  onClick={wallpaper.setPermanent}
                  disabled={!wallpaper.imageUrl}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/20 disabled:opacity-50"
                >
                  <Pin className="h-3.5 w-3.5" /> Set as my wallpaper
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Music2 className="h-4 w-4" /> Study Music
            </div>
            <p className="mt-1 text-xs text-white/65">{music.label} · smooth, no lyrics</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={music.playing ? music.pause : music.play}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/20"
              >
                {music.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {music.playing ? "Pause" : "Play"}
              </button>
              <button
                onClick={music.next}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/20"
              >
                <SkipForward className="h-3.5 w-3.5" /> Next
              </button>
              <button
                onClick={() => music.setMuted(!music.muted)}
                title={music.muted ? "Unmute" : "Mute"}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-white/10 transition-colors hover:bg-white/20"
              >
                {music.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={music.volume}
                onChange={(e) => music.setVolume(parseFloat(e.target.value))}
                className="h-1.5 w-24 accent-white"
              />
            </div>
          </div>
        </div>

        {/* ------------------------------- Join a desk ------------------------------- */}
        <button
          onClick={() => setJoinPanelOpen(true)}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-lg transition-transform hover:scale-105"
        >
          <Video className="h-4 w-4" /> Join a Desk
        </button>
        <p className="mt-2 max-w-sm text-center text-[11px] text-white/60">
          Opens the call in a new tab — this timer, wallpaper, and music keep running here.
        </p>
      </main>

      {joinPanelOpen && <JoinDeskPanel onClose={() => setJoinPanelOpen(false)} />}
    </div>
  );
}

/** Small search + list panel to pick a desk, then reuses the normal JoinDeskModal (which already opens the meet link in a new tab). */
function JoinDeskPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Desk[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDesk, setSelectedDesk] = useState<Desk | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchDesksFull(query));
      } catch {
        toast.error("Couldn't load desks right now.");
      } finally {
        setLoading(false);
      }
    }, query ? 300 : 0);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 text-foreground shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Join a Desk</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search desks by topic…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No desks found.</p>
          ) : (
            results.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setSelectedDesk(d);
                  setConfirmOpen(true);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    {d.isSpecial && <Sparkles className="h-3.5 w-3.5 shrink-0 text-special" />}
                    <span className="truncate text-sm font-semibold">{d.title}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{d.topic}</span>
                </span>
                <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </div>

      <JoinDeskModal
        open={confirmOpen}
        desk={selectedDesk}
        onClose={() => {
          setConfirmOpen(false);
          onClose();
        }}
      />
    </div>
  );
}
