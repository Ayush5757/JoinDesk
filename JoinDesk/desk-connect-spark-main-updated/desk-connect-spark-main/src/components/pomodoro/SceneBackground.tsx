import { useEffect, useRef, useState } from "react";
import { sceneThumb, type Scene } from "@/lib/pomodoro";

const GRADIENT = "linear-gradient(135deg, #1e293b 0%, #334155 45%, #1e3a3a 100%)";

/**
 * The full-screen background of the Focus Timer: a long looping video that never gets in the way.
 *
 *  - It shows a tiny preview picture right away, then the video fades in once it is really playing,
 *    so the page never feels slow or stuck.
 *  - The video is loaded a moment AFTER the page, and not at all in "still image" mode
 *    (also the default on slow or data-saver connections).
 *  - It pauses by itself when the tab is in the background, saving data and battery.
 *  - Videos are YouTube (streamed, so no weight on our site) or a direct .mp4 / .webm link.
 *  - If a video can't play (removed, embedding turned off) `onFailed` lets the page move on.
 */
export function SceneBackground({
  scene,
  still,
  soundOn,
  paused,
  fallbackImage,
  onFailed,
}: {
  scene: Scene | null;
  still: boolean;
  soundOn: boolean;
  paused: boolean;
  fallbackImage: string | null;
  onFailed: () => void;
}) {
  const [mounted, setMounted] = useState(false); // the video element exists
  const [playing, setPlaying] = useState(false); // the video is really playing, so it can fade in
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const failedRef = useRef(onFailed);
  failedRef.current = onFailed;

  const sceneId = scene?.id;
  useEffect(() => {
    setPlaying(false);
    setMounted(false);
    if (!sceneId || still) return;
    const t = setTimeout(() => setMounted(true), 700);
    return () => clearTimeout(t);
  }, [sceneId, still]);

  // ---- YouTube: a tiny message channel to the player (no extra script to load) ----
  const send = (func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  };

  useEffect(() => {
    if (!mounted || scene?.kind !== "youtube") return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      let data: unknown = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const d = data as { event?: string; info?: unknown };
      if (d.event === "onStateChange") {
        if (d.info === 1) setPlaying(true);
        if (d.info === 0) {
          send("seekTo", [0, true]); // safety net: if a video ever ends, start it again
          send("playVideo");
        }
      } else if (d.event === "infoDelivery" && (d.info as { playerState?: number } | undefined)?.playerState === 1) {
        setPlaying(true);
      } else if (d.event === "onError") {
        failedRef.current();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mounted, scene?.kind, sceneId]);

  const onIframeLoad = () => {
    // ask the player to start telling us what it's doing
    const ping = () =>
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
    ping();
    setTimeout(ping, 600);
    setTimeout(ping, 1800);
  };

  // sound of the video itself (off by default; the music preset is the main sound)
  useEffect(() => {
    if (!playing) return;
    if (scene?.kind === "youtube") {
      if (soundOn) {
        send("unMute");
        send("setVolume", [35]);
      } else send("mute");
    } else if (videoRef.current) {
      videoRef.current.muted = !soundOn;
      videoRef.current.volume = 0.35;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn, playing]);

  // pause while the tab is hidden
  useEffect(() => {
    if (!playing) return;
    if (scene?.kind === "youtube") send(paused ? "pauseVideo" : "playVideo");
    else if (videoRef.current) {
      if (paused) videoRef.current.pause();
      else void videoRef.current.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, playing]);

  const preview = sceneThumb(scene) ?? fallbackImage;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-900">
      {/* instant preview picture */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
        style={{ backgroundImage: preview ? `url(${preview})` : GRADIENT, opacity: playing ? 0 : 1 }}
      />

      {mounted && scene?.kind === "youtube" && (
        <iframe
          ref={iframeRef}
          key={scene.id}
          title={scene.title}
          onLoad={onIframeLoad}
          allow="autoplay; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
          src={
            `https://www.youtube-nocookie.com/embed/${scene.source}?autoplay=1&mute=1&controls=0&loop=1` +
            `&playlist=${scene.source}&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0&playsinline=1` +
            `&enablejsapi=1&origin=${encodeURIComponent(origin)}`
          }
          className={
            "pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 scale-[1.06] border-0 transition-opacity duration-1000 " +
            (playing ? "opacity-100" : "opacity-0")
          }
        />
      )}

      {mounted && scene?.kind === "file" && (
        <video
          ref={videoRef}
          key={scene.id}
          src={scene.source}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onPlaying={() => setPlaying(true)}
          onError={() => failedRef.current()}
          className={"absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 " + (playing ? "opacity-100" : "opacity-0")}
        />
      )}

      {/* a very light shade only at the edges, so the picture stays bright and clear */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/25" />
    </div>
  );
}
