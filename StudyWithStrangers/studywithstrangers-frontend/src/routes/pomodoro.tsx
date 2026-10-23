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
  Search,
  Video,
  X,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { FocusTopBar } from "@/components/pomodoro/FocusTopBar";
import { GoalsPopup } from "@/components/pomodoro/GoalsPopup";
import { PageLoader } from "@/components/studywithstrangers/PageLoader";
import { BlockedScreen } from "@/components/studywithstrangers/BlockedScreen";
import { DeskJoinModal } from "@/components/studywithstrangers/DeskJoinModal";
import { loginWithGoogle, logout, readCachedUser, restoreSession, BlockedError, type AppUser } from "@/lib/auth";
import { searchDesksFull } from "@/lib/desks";
import { SceneBackground } from "@/components/pomodoro/SceneBackground";
import { getScenes, sceneThumb, type Scene } from "@/lib/pomodoro";
import { ApiError } from "@/lib/api";
import { trackerApi, type TrackMode, type TrackerState } from "@/lib/tracker";
import { nextSyncAction, type Wanted } from "@/lib/focusSync";
import type { Desk } from "@/lib/deskModel";

export const Route = createFileRoute("/pomodoro")({
  head: () => ({
    meta: [
      { title: "Free Online Focus Timer (Pomodoro) | StudyWithStrangers" },
      {
        name: "description",
        content:
          "A free Pomodoro focus timer with calming study backgrounds. Track your study time and join a desk to focus alongside other people online.",
      },
      { property: "og:url", content: "https://www.studywithstrangers.com/pomodoro" },
    ],
    links: [{ rel: "canonical", href: "https://www.studywithstrangers.com/pomodoro" }],
  }),
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
const WALLPAPER_STORAGE_KEY = "sws_pomodoro_permanent_wallpaper";

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
// any external music API or key. 20 smooth, low-tone presets across three
// families (pad / noise / plucks) that cycle automatically, or on demand
// with "Next". All built from the same handful of generic generators below,
// just with different notes/filters/timing — so adding variety never means
// adding new audio assets.
// =========================================================================
type MusicPresetConfig =
  | { id: string; label: string; kind: "pad"; freqs: number[]; waveform?: OscillatorType }
  | {
      id: string;
      label: string;
      kind: "noise";
      filterFreq: number;
      filterType?: BiquadFilterType;
      gainTarget: number;
      swell?: boolean; // slow amplitude LFO — gives an "ocean wave" feel
    }
  | {
      id: string;
      label: string;
      kind: "pluck";
      scale: number[];
      padFreq?: number;
      waveform?: OscillatorType;
      pluckGain?: number;
      decaySeconds?: number;
      minGapMs?: number;
      maxGapMs?: number;
    };

const MUSIC_PRESETS: MusicPresetConfig[] = [
  // --- Pads (slow, sustained chords) ---
  { id: "pad-cmaj", label: "Soft Pad", kind: "pad", freqs: [130.81, 164.81, 196.0] },
  { id: "pad-amin", label: "Warm Pad", kind: "pad", freqs: [110.0, 130.81, 164.81] },
  { id: "pad-fmaj7", label: "Dreamy Pad", kind: "pad", freqs: [174.61, 220.0, 261.63, 329.63] },
  { id: "pad-drone", label: "Deep Drone", kind: "pad", freqs: [65.41, 130.81], waveform: "sine" },
  { id: "pad-dmin", label: "Twilight Pad", kind: "pad", freqs: [146.83, 174.61, 220.0] },
  { id: "pad-gmaj", label: "Morning Pad", kind: "pad", freqs: [196.0, 246.94, 293.66] },
  { id: "pad-emin", label: "Velvet Pad", kind: "pad", freqs: [164.81, 196.0, 246.94], waveform: "triangle" },

  // --- Noise textures (rain / wind / waves) ---
  { id: "noise-rain-light", label: "Rainy Focus", kind: "noise", filterFreq: 850, gainTarget: 0.3 },
  { id: "noise-rain-heavy", label: "Heavy Rain", kind: "noise", filterFreq: 500, gainTarget: 0.36 },
  { id: "noise-waves", label: "Ocean Waves", kind: "noise", filterFreq: 320, gainTarget: 0.32, swell: true },
  { id: "noise-wind", label: "Wind Whisper", kind: "noise", filterFreq: 1400, filterType: "bandpass", gainTarget: 0.22 },
  { id: "noise-brown", label: "Brown Noise Deep", kind: "noise", filterFreq: 200, gainTarget: 0.28 },
  { id: "noise-cafe", label: "Café Hum", kind: "noise", filterFreq: 900, filterType: "bandpass", gainTarget: 0.2 },

  // --- Plucked notes (pentatonic, always pleasant) ---
  { id: "pluck-c", label: "Gentle Chimes", kind: "pluck", scale: [523.25, 587.33, 659.25, 783.99, 880.0], padFreq: 196.0 },
  { id: "pluck-d", label: "Wind Chimes", kind: "pluck", scale: [587.33, 659.25, 739.99, 880.0, 987.77], minGapMs: 3500, maxGapMs: 5500 },
  { id: "pluck-g-marimba", label: "Soft Marimba", kind: "pluck", scale: [392.0, 440.0, 493.88, 587.33, 659.25], waveform: "triangle", padFreq: 130.81 },
  { id: "pluck-crickets", label: "Night Crickets", kind: "pluck", scale: [1046.5, 1174.7, 1318.5], pluckGain: 0.05, decaySeconds: 0.4, minGapMs: 1500, maxGapMs: 4000 },
  { id: "pluck-musicbox", label: "Music Box", kind: "pluck", scale: [523.25, 587.33, 659.25, 698.46, 783.99, 880.0], decaySeconds: 1.6, minGapMs: 900, maxGapMs: 2200 },
  { id: "pluck-zen", label: "Zen Bells", kind: "pluck", scale: [466.16, 523.25, 622.25, 698.46], decaySeconds: 4.5, minGapMs: 4000, maxGapMs: 7000, padFreq: 116.54 },
  { id: "pluck-lullaby", label: "Lullaby Plucks", kind: "pluck", scale: [311.13, 349.23, 415.3, 466.16, 622.25], decaySeconds: 3, minGapMs: 3000, maxGapMs: 5000, waveform: "triangle" },
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

  // --- Generic generators, shared by every preset above ---

  function playPad(
    ctx: AudioContext,
    master: GainNode,
    freqs: number[],
    waveform: OscillatorType,
    stoppers: Array<() => void>
  ) {
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = waveform;
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
  }

  function playNoise(
    ctx: AudioContext,
    master: GainNode,
    filterFreq: number,
    filterType: BiquadFilterType,
    gainTarget: number,
    swell: boolean,
    stoppers: Array<() => void>
  ) {
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
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(filter).connect(g).connect(master);
    src.start();
    g.gain.linearRampToValueAtTime(gainTarget, ctx.currentTime + 2);

    let swellLfo: OscillatorNode | null = null;
    let swellGain: GainNode | null = null;
    if (swell) {
      // A very slow amplitude wobble on top of the base level — the
      // "waves rolling in" feel for the Ocean Waves preset.
      swellLfo = ctx.createOscillator();
      swellLfo.frequency.value = 0.08;
      swellGain = ctx.createGain();
      swellGain.gain.value = gainTarget * 0.4;
      swellLfo.connect(swellGain).connect(g.gain);
      swellLfo.start();
    }

    stoppers.push(() => {
      try {
        src.stop();
        swellLfo?.stop();
      } catch {
        /* already stopped */
      }
    });
  }

  function playPluck(
    ctx: AudioContext,
    master: GainNode,
    config: Extract<MusicPresetConfig, { kind: "pluck" }>,
    stoppers: Array<() => void>
  ) {
    const {
      scale,
      padFreq,
      waveform = "sine",
      pluckGain = 0.11,
      decaySeconds = 3,
      minGapMs = 2500,
      maxGapMs = 6000,
    } = config;

    if (padFreq) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = padFreq;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.0001;
      osc.connect(oscGain).connect(master);
      osc.start();
      oscGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 2);
      stoppers.push(() => {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      });
    }

    let timeoutId = 0;
    const pluck = () => {
      const f = scale[Math.floor(Math.random() * scale.length)] ?? scale[0] ?? 523.25;
      const o = ctx.createOscillator();
      o.type = waveform;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g).connect(master);
      o.start();
      const t = ctx.currentTime;
      g.gain.linearRampToValueAtTime(pluckGain, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decaySeconds);
      o.stop(t + decaySeconds + 0.2);
      timeoutId = window.setTimeout(pluck, minGapMs + Math.random() * (maxGapMs - minGapMs));
    };
    pluck();
    stoppers.push(() => window.clearTimeout(timeoutId));
  }

  const startPreset = (config: MusicPresetConfig) => {
    const { ctx, master } = ensureContext();
    stopCurrentRef.current();
    const stoppers: Array<() => void> = [];

    if (config.kind === "pad") {
      playPad(ctx, master, config.freqs, config.waveform ?? "sine", stoppers);
    } else if (config.kind === "noise") {
      playNoise(
        ctx,
        master,
        config.filterFreq,
        config.filterType ?? "lowpass",
        config.gainTarget,
        Boolean(config.swell),
        stoppers
      );
    } else {
      playPluck(ctx, master, config, stoppers);
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
    startPreset(getMusicPreset(presetIndex));
    setPlaying(true);
  };
  const pause = () => {
    stopCurrentRef.current();
    setPlaying(false);
  };
  const next = () => {
    const nextIndex = (presetIndex + 1) % MUSIC_PRESETS.length;
    setPresetIndex(nextIndex);
    if (playing) startPreset(getMusicPreset(nextIndex));
  };

  // A scene can ask for the music that suits it (waves for the beach, rain for the forest...).
  const selectPreset = (id: string) => {
    const index = MUSIC_PRESETS.findIndex((p) => p.id === id);
    if (index < 0) return;
    setPresetIndex(index);
    if (playing) startPreset(getMusicPreset(index));
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
    selectPreset,
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
      document.title = "Focus Timer — StudyWithStrangers";
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
const SCENE_KEY = "sws_focus_scene";
const STILL_KEY = "sws_focus_still";

function PomodoroPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    // Back / return visit: show the signed-in screen straight away, then confirm in the background.
    const cached = readCachedUser();
    if (cached) {
      setUser(cached);
      setCheckingSession(false);
    }
    restoreSession()
      .then(setUser)
      .catch((err) => {
        if (err instanceof BlockedError) setIsBlocked(true);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  // A photo is only the backup picture (no scene, or still-image mode).
  const wallpaper = useStudyWallpaper();
  const music = useAmbientMusic();
  const timer = usePomodoroTimer();
  const [joinPanelOpen, setJoinPanelOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);

  // ---------------- study time: the Focus Timer can count it for you ----------------
  // 'focus'  = the timer's study rounds are counted automatically (breaks are counted as breaks)
  // 'manual' = the timer is only a timer; time is counted with Let's go / Stop in the tracker
  // null     = not chosen yet
  const [trackMode, setTrackMode] = useState<TrackMode>(null);
  const [counting, setCounting] = useState(false); // is the tracker counting study time right now?
  const onTrackerState = (t: TrackerState) => {
    setTrackMode(t.mode);
    setCounting(t.session.status === "studying");
  };

  // learn how this person counts study time
  useEffect(() => {
    if (!user) {
      setTrackMode(null);
      setCounting(false);
      return;
    }
    trackerApi
      .state()
      .then(onTrackerState)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Focus Timer mode: a running study round = studying; a break round or a paused timer = a break.
  // Calls go one after another, so quick changes can never overtake each other.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const lastWanted = useRef<Wanted | null>(null);
  useEffect(() => {
    if (!user || trackMode !== "focus") {
      lastWanted.current = null;
      return;
    }
    const { wanted, call } = nextSyncAction(lastWanted.current, timer.running, timer.phase);
    lastWanted.current = wanted;
    if (!call) return;
    queue.current = queue.current.then(async () => {
      try {
        const t = wanted === "study" ? await trackerApi.start() : await trackerApi.pause();
        setCounting(t.session.status === "studying");
      } catch (err) {
        if (wanted === "study" && err instanceof ApiError && err.status === 409) {
          toast("Save your earlier day's progress first, then your time will count again.");
          setGoalsOpen(true);
        } else if (wanted === "study") {
          toast("Couldn't update your study time. Check your connection.");
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.running, timer.phase, trackMode, user?.id]);

  // ---------------- background scenes ----------------
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [still, setStill] = useState(false); // picture only, no video (saves data)
  const [videoSound, setVideoSound] = useState(false);
  const [hud, setHud] = useState(true); // the small panels; hide them to see the whole scene
  const [tabHidden, setTabHidden] = useState(false);
  const failedCount = useRef(0);

  // top bar: hidden by default, shown on hover (and for a few seconds at the start)
  const [barVisible, setBarVisible] = useState(true);
  const barTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBar = () => {
    if (barTimer.current) clearTimeout(barTimer.current);
    setBarVisible(true);
  };
  const hideBarSoon = (ms = 1200) => {
    if (barTimer.current) clearTimeout(barTimer.current);
    barTimer.current = setTimeout(() => setBarVisible(false), ms);
  };
  useEffect(() => {
    hideBarSoon(3500);
    return () => {
      if (barTimer.current) clearTimeout(barTimer.current);
    };
  }, []);

  // full screen
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [fsHint, setFsHint] = useState(false);
  const [cursorIdle, setCursorIdle] = useState(false);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => toast("Full screen isn't available in this browser."));
  };
  useEffect(() => {
    setCanFullscreen(Boolean(document.fullscreenEnabled));
    const onChange = () => {
      const on = Boolean(document.fullscreenElement);
      setFullscreen(on);
      setHud(!on); // full screen = just the picture and the time
      setBarVisible(false);
      if (on) {
        setFsHint(true);
        setTimeout(() => setFsHint(false), 4500);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // in full screen the mouse pointer also gets out of the way when it isn't moving
  useEffect(() => {
    if (!fullscreen) {
      setCursorIdle(false);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setCursorIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setCursorIdle(true), 2500);
    };
    wake();
    window.addEventListener("mousemove", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      clearTimeout(t);
    };
  }, [fullscreen]);

  useEffect(() => {
    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const saved = localStorage.getItem(STILL_KEY);
    setStill(
      saved !== null ? saved === "1" : Boolean(conn?.saveData) || conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g",
    );
    getScenes().then((list) => {
      setScenes(list);
      const i = list.findIndex((sc) => sc.id === localStorage.getItem(SCENE_KEY));
      setSceneIndex(i >= 0 ? i : 0);
    });
  }, []);

  useEffect(() => {
    const onVis = () => setTabHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "h" || e.key === "H") setHud((v) => !v);
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "g" || e.key === "G") setGoalsOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const scene = scenes[sceneIndex] ?? null;

  // each scene brings the music that suits it
  useEffect(() => {
    if (scene?.music) music.selectPreset(scene.music);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id]);

  const chooseScene = (i: number) => {
    failedCount.current = 0;
    setSceneIndex(i);
    const sc = scenes[i];
    if (sc) localStorage.setItem(SCENE_KEY, sc.id);
  };

  const onSceneFailed = () => {
    failedCount.current += 1;
    if (failedCount.current >= scenes.length) {
      setStill(true);
      toast("Couldn't play the videos right now, so we're showing a picture.");
      return;
    }
    toast("That video isn't available. Trying another.");
    setSceneIndex((i) => (i + 1) % scenes.length);
  };

  const toggleStill = () => {
    const next = !still;
    setStill(next);
    localStorage.setItem(STILL_KEY, next ? "1" : "0");
  };

  const handleLogin = async () => {
    try {
      setUser(await loginWithGoogle());
    } catch (err) {
      if (err instanceof BlockedError) setIsBlocked(true);
    }
  };

  if (checkingSession) return <PageLoader />;
  if (isBlocked) return <BlockedScreen />;

  const chip =
    "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-white/20";
  const round =
    "grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 transition-colors hover:bg-white/20";

  return (
    <div
      className={
        "relative h-screen min-h-[520px] overflow-hidden text-white " + (fullscreen && cursorIdle ? "cursor-none" : "")
      }
    >
      <SceneBackground
        scene={scene}
        still={still}
        soundOn={videoSound}
        paused={tabHidden}
        fallbackImage={wallpaper.imageUrl}
        onFailed={onSceneFailed}
      />

      <FocusTopBar
        visible={barVisible}
        onShow={showBar}
        onHideSoon={() => hideBarSoon(900)}
        user={user}
        onLogin={handleLogin}
        onJoin={() => setJoinPanelOpen(true)}
        onGoals={() => setGoalsOpen(true)}
        hud={hud}
        onToggleHud={() => setHud((v) => !v)}
        canFullscreen={canFullscreen}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {fsHint && (
        <p className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full bg-black/45 px-4 py-2 text-xs font-medium backdrop-blur-md">
          Full screen · move the mouse to the top for the menu · <b>F</b> or <b>Esc</b> to exit · <b>H</b> panels · <b>G</b> goals
        </p>
      )}

      {/* Everything else is small and sits at the bottom edge, so the scene stays clear. */}
      <div className="absolute inset-0">
        {hud && (
          <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            {/* ------------------------------- timer ------------------------------- */}
            <div className="w-full rounded-2xl border border-white/15 bg-black/35 p-3 shadow-xl backdrop-blur-md sm:w-56">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-white/70">
                <span>{phaseLabel(timer.phase)}</span>
                <span>
                  {timer.completedSessions} done
                </span>
              </div>
              <p className="mt-0.5 font-mono text-3xl font-semibold tabular-nums">{formatTime(timer.secondsLeft)}</p>
              {user && trackMode === "focus" && (
                <p className="text-[10px] text-white/60">
                  {counting ? "● Counted as study time" : "Study rounds count as study time"}
                </p>
              )}
              {user && trackMode === null && (
                <button onClick={() => setGoalsOpen(true)} className="text-[10px] font-semibold text-white/70 underline-offset-2 hover:underline">
                  Count my study time →
                </button>
              )}
              <div className="mt-2 flex items-center gap-1.5">
                {timer.running ? (
                  <button onClick={timer.pause} title="Pause" className={round + " bg-white text-slate-900 hover:bg-white/90"}>
                    <Pause className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button onClick={timer.start} title="Start" className={round + " bg-white text-slate-900 hover:bg-white/90"}>
                    <Play className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={timer.resetTimer} title="Reset" className={round}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <div className="ml-auto inline-flex rounded-full border border-white/20 bg-black/20 p-0.5 text-[10px] font-semibold">
                  {(Object.keys(TIMER_PRESETS) as PresetKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => timer.setPresetKey(key)}
                      className={
                        "rounded-full px-2 py-0.5 transition-colors " +
                        (timer.presetKey === key ? "bg-white text-slate-900" : "text-white/70 hover:text-white")
                      }
                    >
                      {TIMER_PRESETS[key].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ------------------------------- scene + music ------------------------------- */}
            <div className="w-full rounded-2xl border border-white/15 bg-black/35 p-3 shadow-xl backdrop-blur-md sm:w-72">
              {scenes.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {scenes.map((sc, i) => {
                    const thumb = sceneThumb(sc);
                    return (
                      <button
                        key={sc.id}
                        onClick={() => chooseScene(i)}
                        title={`${sc.title} · ${sc.category}`}
                        className={
                          "relative h-9 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-700 bg-cover bg-center ring-2 transition-all " +
                          (i === sceneIndex ? "ring-white" : "ring-transparent opacity-70 hover:opacity-100")
                        }
                        style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                      >
                        {!thumb && <span className="absolute inset-0 grid place-items-center text-[9px] font-bold">{sc.category}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-1.5 truncate text-[11px] font-medium text-white/80">
                {scene ? `${scene.title} · ${scene.category}` : "Loading scenes…"}
              </p>

              <div className="mt-2 flex items-center gap-1.5">
                <button onClick={music.playing ? music.pause : music.play} title={music.playing ? "Pause music" : "Play music"} className={round}>
                  {music.playing ? <Pause className="h-3.5 w-3.5" /> : <Music2 className="h-3.5 w-3.5" />}
                </button>
                <button onClick={music.next} title="Next music" className={round}>
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => music.setMuted(!music.muted)} title={music.muted ? "Unmute" : "Mute"} className={round}>
                  {music.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={music.volume}
                  onChange={(e) => music.setVolume(parseFloat(e.target.value))}
                  className="h-1 min-w-0 flex-1 accent-white"
                  aria-label="Music volume"
                />
              </div>
              <p className="mt-1 truncate text-[10px] text-white/60">{music.label} · no lyrics</p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button onClick={() => setVideoSound((v) => !v)} className={chip} title="Hear the sound of the video itself">
                  {videoSound ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />} Video sound
                </button>
                <button onClick={toggleStill} className={chip} title="Show a picture instead of the moving video, to save data">
                  <ImageIcon className="h-3 w-3" /> {still ? "Still image" : "Video"}
                </button>
              </div>
            </div>
          </div>
        )}

        {!hud && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/30 py-1 pl-3.5 pr-1 backdrop-blur-md">
            <span className="font-mono text-sm font-semibold tabular-nums">{formatTime(timer.secondsLeft)}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">{phaseLabel(timer.phase)}</span>
            <button
              onClick={timer.running ? timer.pause : timer.start}
              title={timer.running ? "Pause" : "Start"}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
            >
              {timer.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>

      {goalsOpen && (
        <GoalsPopup
          user={user}
          onClose={() => setGoalsOpen(false)}
          onLogin={handleLogin}
          onBlocked={() => setIsBlocked(true)}
          onTrackerState={onTrackerState}
        />
      )}

      {joinPanelOpen && <DeskJoinPanel onClose={() => setJoinPanelOpen(false)} />}
    </div>
  );
}

/** Small search + list panel to pick a desk, then reuses the normal DeskJoinModal (which already opens the meet link in a new tab). */
function DeskJoinPanel({ onClose }: { onClose: () => void }) {
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

      <DeskJoinModal
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
