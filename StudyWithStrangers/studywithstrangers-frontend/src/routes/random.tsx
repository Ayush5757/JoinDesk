import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CreditCard,
  Volume2,
  Headphones,
  Flag,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  SkipForward,
  Video,
  VideoOff,
} from "lucide-react";
import { toast } from "sonner";
import { PageLoader } from "@/components/studywithstrangers/PageLoader";
import { BlockedScreen } from "@/components/studywithstrangers/BlockedScreen";
import { GoogleIcon } from "@/components/studywithstrangers/GoogleIcon";
import { Sheet } from "@/components/tracker/Sheet";
import { ApiError } from "@/lib/api";
import { loginWithGoogle, readCachedUser, restoreSession, BlockedError, type AppUser } from "@/lib/auth";
import {
  RandomClient,
  randomApi,
  type CallState,
  type CallStats,
  type RandomConfig,
  type ReportReason,
} from "@/lib/random";

export const Route = createFileRoute("/random")({
  head: () => ({
    meta: [
      { title: "Random Video Chat to Study With Strangers | StudyWithStrangers" },
      {
        name: "description",
        content:
          "Meet a random study partner in a free 1-on-1 video chat. Skip to the next person any time and find someone to focus with, right in your browser.",
      },
      { property: "og:url", content: "https://www.studywithstrangers.com/random" },
    ],
    links: [{ rel: "canonical", href: "https://www.studywithstrangers.com/random" }],
  }),
  component: RandomPage,
});

type Phase = "checking" | "login" | "blocked" | "off" | "paywall" | "intro" | "live";

const RULES_KEY = "random_rules_v1";
const MAX_AUTO_RETRIES = 3;

const REASONS: { v: ReportReason; label: string }[] = [
  { v: "nudity", label: "Nudity or sexual content" },
  { v: "harassment", label: "Harassment or hate" },
  { v: "underage", label: "Looks under 18" },
  { v: "spam", label: "Spam or ads" },
  { v: "other", label: "Something else" },
];

function mediaErrorText(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera and microphone are blocked. Allow them in your browser's address bar, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "We couldn't find a camera or microphone on this device.";
  if (name === "NotReadableError") return "Your camera is being used by another app. Close it and try again.";
  return "Couldn't start your camera and microphone.";
}

function RandomPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [config, setConfig] = useState<RandomConfig | null>(null);
  const [payment, setPayment] = useState<RandomConfig["payment"]>(null);

  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState("");

  const [call, setCall] = useState<CallState>("idle");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [notice, setNotice] = useState("");
  const [reporting, setReporting] = useState(false);

  const clientRef = useRef<RandomClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const retries = useRef(0);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [headphones, setHeadphones] = useState(false);

  // ---------- who is this, and may they use it? ----------
  const loadConfig = useCallback(async () => {
    try {
      const c = await randomApi.config();
      setConfig(c);
      setPayment(c.payment);
      if (!c.enabled) setPhase("off");
      else if (!c.allowed) setPhase("paywall");
      else setPhase("intro");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setPhase("blocked");
      else {
        setProblem("Couldn't load Random chat. Check your connection and refresh.");
        setPhase("intro");
      }
    }
  }, []);

  useEffect(() => {
    setAgreed(localStorage.getItem(RULES_KEY) === "1");
    const cached = readCachedUser();
    if (cached) setUser(cached);
    restoreSession()
      .then((u) => {
        setUser(u);
        if (u) void loadConfig();
        else setPhase("login");
      })
      .catch((err) => setPhase(err instanceof BlockedError ? "blocked" : "login"));
  }, [loadConfig]);

  // ---------- release camera / tell the other person when leaving ----------
  const releaseMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    const onHide = () => clientRef.current?.dispose();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      clientRef.current?.dispose();
      clientRef.current = null;
      releaseMedia();
    };
  }, [releaseMedia]);

  // ---------- keep the <video> tags in sync ----------
  const [, bump] = useState(0);
  useEffect(() => {
    if (localVideo.current && streamRef.current && localVideo.current.srcObject !== streamRef.current) {
      localVideo.current.muted = true; // never play your own microphone back through the speakers
      localVideo.current.srcObject = streamRef.current;
    }
    const rv = remoteVideo.current;
    if (rv && rv.srcObject !== remoteStream.current) {
      rv.srcObject = remoteStream.current;
      if (remoteStream.current) {
        // Play with sound. If the browser refuses (autoplay rules) show a tap-to-enable button.
        rv.muted = false;
        rv.play().then(
          () => setSoundBlocked(false),
          () => setSoundBlocked(true),
        );
      } else {
        setSoundBlocked(false);
      }
    }
  });

  const enableSound = () => {
    const rv = remoteVideo.current;
    if (!rv) return;
    rv.muted = false;
    void rv.play().then(() => setSoundBlocked(false), () => setSoundBlocked(true));
  };

  // How the sound is doing, read from the connection itself every couple of seconds.
  useEffect(() => {
    if (call !== "connected") {
      setStats(null);
      return;
    }
    const id = setInterval(() => {
      void clientRef.current?.getStats().then((s) => s && setStats(s));
    }, 1500);
    return () => clearInterval(id);
  }, [call]);

  const myLevel = micOn ? (stats?.micLevel ?? 0) * 3 : 0;
  const theirLevel = stats?.heardLevel ?? 0;

  // Headphones mode: turns off the browser's echo / noise clean-up. With headphones that makes the voice
  // clearer; without them it can cause echo, so it's off by default.
  const toggleHeadphones = () => {
    const on = !headphones;
    streamRef.current?.getAudioTracks().forEach((t) => {
      void t
        .applyConstraints({ echoCancellation: !on, noiseSuppression: !on, autoGainControl: !on })
        .catch(() => {});
    });
    setHeadphones(on);
    toast(on ? "Headphones mode on. Use headphones, or you'll get echo." : "Echo protection is back on.");
  };

  // ---------- one place that handles "you can't search right now" ----------
  const handleSearchError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 402) {
        setPayment((err.data as RandomConfig["payment"]) ?? null);
        setPhase("paywall");
      } else if (err instanceof ApiError && err.status === 403 && (err.data as { blocked?: boolean })?.blocked) {
        setPhase("blocked");
      } else {
        setProblem(err instanceof Error ? err.message : "Couldn't start. Try again.");
        clientRef.current?.stop();
      }
    },
    [],
  );

  const makeClient = (stream: MediaStream, ice: RTCIceServer[]) =>
    new RandomClient(stream, ice, {
      onState: (s) => {
        setCall(s);
        if (s === "connected") {
          retries.current = 0;
          setNotice("");
        }
        if (s === "idle") {
          setPhase((p) => (p === "live" ? "intro" : p));
          releaseMedia();
        }
      },
      onRemote: (s) => {
        remoteStream.current = s;
        bump((n) => n + 1);
      },
    });

  const start = async () => {
    if (!config || starting) return;
    setStarting(true);
    setProblem("");
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 }, facingMode: "user" },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            channelCount: 1,
            sampleRate: { ideal: 48000 },
          },
        });
      } catch (err) {
        setProblem(mediaErrorText(err));
        return;
      }
      localStorage.setItem(RULES_KEY, "1");
      streamRef.current = stream;
      // tell the browser this is a voice, so it tunes the sound for speech
      stream.getAudioTracks().forEach((t) => {
        try {
          (t as MediaStreamTrack & { contentHint?: string }).contentHint = "speech";
        } catch {
          /* not supported: fine */
        }
      });
      if (stream.getAudioTracks().length === 0) {
        toast.error("No microphone found, so the other person won't hear you.");
      }
      setMicOn(true);
      setCamOn(true);
      setHeadphones(false);
      retries.current = 0;
      setNotice("");
      clientRef.current = makeClient(stream, config.iceServers);
      setPhase("live");
      try {
        await clientRef.current.start();
      } catch (err) {
        releaseMedia();
        setPhase("intro");
        handleSearchError(err);
      }
    } finally {
      setStarting(false);
    }
  };

  const next = useCallback(async () => {
    const c = clientRef.current;
    if (!c) return;
    setNotice("");
    try {
      await c.next();
    } catch (err) {
      handleSearchError(err);
    }
  }, [handleSearchError]);

  // someone's network blocks direct calls: quietly try the next person a few times
  useEffect(() => {
    if (call !== "failed") return;
    if (retries.current >= MAX_AUTO_RETRIES) return;
    retries.current += 1;
    setNotice("Couldn't connect to that person. Finding someone else…");
    const t = setTimeout(() => void next(), 1200);
    return () => clearTimeout(t);
  }, [call, next]);

  // the other person left: move on to someone new straight away, no tap needed
  useEffect(() => {
    if (call !== "partner-left") return;
    const t = setTimeout(() => void next(), 600);
    return () => clearTimeout(t);
  }, [call, next]);

  // the little notice fades by itself
  useEffect(() => {
    if (!notice || call === "failed") return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice, call]);

  const stop = () => {
    clientRef.current?.stop();
    clientRef.current = null;
    releaseMedia();
    setPhase("intro");
  };

  const toggleMic = () => {
    const on = !micOn;
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = on));
    setMicOn(on);
  };
  const toggleCam = () => {
    const on = !camOn;
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = on));
    setCamOn(on);
  };

  const sendReport = async (reason: ReportReason, details: string) => {
    const room = clientRef.current?.partnerRoomId;
    if (!room) {
      setReporting(false);
      return;
    }
    try {
      await randomApi.report(room, reason, details);
      toast.success("Reported. You won't be matched with them again.");
      setReporting(false);
      void next();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the report.");
    }
  };

  const handleLogin = async () => {
    try {
      const u = await loginWithGoogle();
      setUser(u);
      setPhase("checking");
      void loadConfig();
    } catch (err) {
      if (err instanceof BlockedError) setPhase("blocked");
      else toast.error(err instanceof Error ? err.message : "Couldn't sign in with Google.");
    }
  };

  // ================= screens =================
  if (phase === "checking") return <PageLoader />;
  if (phase === "blocked") return <BlockedScreen />;

  if (phase === "login") {
    return (
      <Centered>
        <h1 className="text-xl font-bold tracking-tight">Random chat</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to meet someone new on a quick 1-on-1 video call.</p>
        <button
          onClick={handleLogin}
          className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <GoogleIcon /> Continue with Google
        </button>
      </Centered>
    );
  }

  if (phase === "off") {
    return (
      <Centered>
        <h1 className="text-xl font-bold tracking-tight">Random chat is paused</h1>
        <p className="mt-2 text-sm text-muted-foreground">It's switched off for now. Please check back soon.</p>
        <BackLink />
      </Centered>
    );
  }

  if (phase === "paywall") {
    return (
      <Centered>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <CreditCard className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Random chat is for members</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Get a subscription to meet new people on 1-on-1 video calls, and unlock Special desks too.
        </p>
        {payment && payment.priceInr > 0 && (
          <p className="mt-4 text-3xl font-bold tracking-tight">
            ₹{payment.priceInr}
            <span className="ml-1 text-xs font-medium text-muted-foreground">/ {payment.days} days</span>
          </p>
        )}
        {payment?.message?.trim() && (
          <p className="mt-4 whitespace-pre-line rounded-xl bg-muted/60 p-3 text-left text-xs leading-relaxed">{payment.message}</p>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Your access is turned on by the team after they confirm your payment.</p>
        <BackLink />
      </Centered>
    );
  }

  if (phase === "intro") {
    const returning = typeof window !== "undefined" && localStorage.getItem(RULES_KEY) === "1";
    return (
      <Centered wide>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-primary-foreground shadow-glow">
          <Video className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Meet someone new</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          A quick 1-on-1 video call with another student. Don't like it? Hit Next.
        </p>

        <ul className="mx-auto mt-6 max-w-sm space-y-2.5 text-left text-sm">
          {[
            "You must be 18 or older.",
            "Be respectful. No nudity, harassment or hate.",
            "Never share your phone number, address or other personal details.",
            "Report anyone who makes you uncomfortable. They won't be matched with you again and our team reviews it.",
            "Video goes directly between you and the other person. We don't record or store it.",
          ].map((r) => (
            <li key={r} className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span className="text-foreground/80">{r}</span>
            </li>
          ))}
        </ul>

        {!returning && (
          <label className="mx-auto mt-6 flex max-w-sm cursor-pointer items-start gap-2.5 text-left text-xs text-muted-foreground">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
            I'm 18 or older and I agree to these rules.
          </label>
        )}

        {problem && <p className="mx-auto mt-4 max-w-sm rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{problem}</p>}

        <button
          onClick={start}
          disabled={starting || (!returning && !agreed)}
          className="mx-auto mt-6 inline-flex h-14 w-full max-w-xs items-center justify-center gap-2.5 rounded-full bg-brand-gradient text-base font-semibold text-primary-foreground shadow-soft transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5 w-5" />}
          Start
        </button>
        <p className="mt-3 text-[11px] text-muted-foreground">Your browser will ask to use your camera and microphone.</p>
        <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
          Tip: use headphones. If two devices are in the same room without headphones, they pick up each other's sound and you'll hear echo and broken words.
        </p>
        <BackLink />
      </Centered>
    );
  }

  // ---------- live ----------
  const connected = call === "connected";
  const gaveUp = call === "failed" && retries.current >= MAX_AUTO_RETRIES;

  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-950 text-white">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <button onClick={stop} className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Leave
        </button>
        <p className="text-sm font-semibold">Random chat</p>
        <span className="w-14" />
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          className={"absolute inset-0 h-full w-full object-cover transition-opacity duration-500 " + (connected ? "opacity-100" : "opacity-0")}
        />

        {/* what's happening */}
        {!connected && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            {call === "partner-left" ? (
              <div>
                <p className="text-2xl font-semibold tracking-tight">They left</p>
                <p className="mt-1 text-sm text-white/60">Finding someone new…</p>
              </div>
            ) : gaveUp ? (
              <div>
                <p className="text-2xl font-semibold tracking-tight">Couldn't connect</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-white/60">
                  Some networks (like strict college WiFi) block direct video calls. Try again, or switch to mobile data.
                </p>
                <button
                  onClick={() => {
                    retries.current = 0;
                    void next();
                  }}
                  className="mt-6 rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div>
                <span className="relative mx-auto grid h-16 w-16 place-items-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/15" />
                  <span className="relative grid h-12 w-12 place-items-center rounded-full bg-white/10">
                    <Video className="h-5 w-5" />
                  </span>
                </span>
                <p className="mt-5 text-xl font-semibold tracking-tight">
                  {call === "connecting" ? "Connecting…" : "Looking for someone…"}
                </p>
                <p className="mt-1 text-sm text-white/60">
                  {call === "connecting" ? "Say hi in a second." : "Stay on this screen. It usually takes a moment."}
                </p>
              </div>
            )}
          </div>
        )}

        {connected && soundBlocked && (
          <button
            onClick={enableSound}
            className="absolute left-1/2 top-16 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg"
          >
            <Volume2 className="h-4 w-4" /> Tap to turn on sound
          </button>
        )}

        {connected && !soundBlocked && theirLevel > 0.03 && (
          <span className="absolute left-4 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-medium backdrop-blur-md">
            <Volume2 className="h-3.5 w-3.5" /> Speaking
          </span>
        )}

        {notice && (
          <p className="absolute left-1/2 top-3 max-w-[90%] -translate-x-1/2 rounded-full bg-white/15 px-4 py-2 text-center text-xs font-medium backdrop-blur-md">
            {notice}
          </p>
        )}

        {/* you */}
        <div className="absolute bottom-28 right-4 aspect-[3/4] w-24 overflow-hidden rounded-2xl border border-white/20 bg-neutral-900 shadow-lg sm:w-36">
          <video ref={localVideo} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          {!camOn && (
            <span className="absolute inset-0 grid place-items-center bg-neutral-900/90">
              <VideoOff className="h-5 w-5 text-white/60" />
            </span>
          )}
          {/* your mic level: if this moves when you talk, they can hear you */}
          <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/20">
            <span
              className={"block h-full rounded-full transition-[width] duration-100 " + (micOn ? "bg-emerald-400" : "bg-red-400")}
              style={{ width: micOn ? `${Math.round(myLevel * 100)}%` : "100%" }}
            />
          </span>
        </div>

        {/* controls */}
        <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full bg-white/10 p-2 backdrop-blur-xl sm:gap-3">
            <RoundButton label={micOn ? "Mute" : "Unmute"} onClick={toggleMic} off={!micOn}>
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </RoundButton>
            <RoundButton label={camOn ? "Camera off" : "Camera on"} onClick={toggleCam} off={!camOn}>
              {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </RoundButton>
            <button
              onClick={() => void next()}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition-transform active:scale-95"
            >
              <SkipForward className="h-4 w-4" /> Next
            </button>
            <RoundButton label={headphones ? "Headphones mode: on" : "Using headphones?"} onClick={toggleHeadphones} off={headphones}>
              <Headphones className="h-5 w-5" />
            </RoundButton>
            <RoundButton label="Report" onClick={() => setReporting(true)} disabled={!clientRef.current?.partnerRoomId}>
              <Flag className="h-5 w-5" />
            </RoundButton>
            <RoundButton label="Stop" onClick={stop} danger>
              <PhoneOff className="h-5 w-5" />
            </RoundButton>
          </div>
        </div>
      </div>

      {reporting && <ReportSheet onSubmit={sendReport} onClose={() => setReporting(false)} />}
    </div>
  );
}

// ---------- small pieces ----------
function Centered({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div
        className={
          "w-full rounded-[28px] border border-border bg-card p-8 text-center shadow-soft " + (wide ? "max-w-lg" : "max-w-sm")
        }
      >
        {children}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/" className="mt-5 inline-block text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
      Back to desks
    </Link>
  );
}

function RoundButton({
  children,
  label,
  onClick,
  off,
  danger,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  off?: boolean | undefined;
  danger?: boolean | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        "grid h-12 w-12 place-items-center rounded-full transition-colors disabled:opacity-40 " +
        (danger ? "bg-red-500 text-white hover:bg-red-500/90" : off ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20")
      }
    >
      {children}
    </button>
  );
}

function ReportSheet({
  onSubmit,
  onClose,
}: {
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <Sheet onClose={onClose}>
      <div className="text-foreground">
        <h2 className="text-xl font-bold tracking-tight">Report this person</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          They won't be matched with you again. Our team reviews every report.
        </p>
        <div className="mt-4 space-y-2">
          {REASONS.map((r) => (
            <button
              key={r.v}
              onClick={() => setReason(r.v)}
              className={
                "w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors " +
                (reason === r.v ? "border-primary bg-primary/10" : "border-border hover:bg-muted")
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Anything else we should know? (optional)"
          className="mt-3 w-full resize-none rounded-2xl border border-border bg-muted/40 p-3 text-sm outline-none focus:border-primary/50 focus:bg-card"
        />
        <button
          disabled={!reason || sending}
          onClick={async () => {
            if (!reason) return;
            setSending(true);
            await onSubmit(reason, details.trim());
            setSending(false);
          }}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          Report and find someone new
        </button>
        <button onClick={onClose} className="mt-2 w-full rounded-full px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
