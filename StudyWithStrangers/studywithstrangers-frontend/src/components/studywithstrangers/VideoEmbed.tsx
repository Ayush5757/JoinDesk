import { useEffect, useRef } from "react";
import { parseYouTubeId, youTubeEmbedUrl } from "@/lib/video";

/** A normal, watch-if-you-like video (YouTube link or MP4/WebM file) with the usual controls. */
export function VideoEmbed({
  url,
  autoPlay = false,
  className = "",
}: {
  url: string;
  autoPlay?: boolean;
  className?: string;
}) {
  const ytId = parseYouTubeId(url);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ytId || !autoPlay) return;
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    void v.play().catch(() => {
      /* the browser wants a tap first: the controls are right there */
    });
  }, [ytId, autoPlay, url]);

  if (ytId) {
    return (
      <div className={"aspect-video w-full overflow-hidden bg-black " + className}>
        <iframe
          src={youTubeEmbedUrl(ytId, { autoplay: autoPlay })}
          title="Video"
          className="h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <video
      ref={ref}
      src={url}
      controls
      playsInline
      preload="metadata"
      className={"mx-auto block max-h-[65vh] w-full bg-black object-contain " + className}
    />
  );
}
