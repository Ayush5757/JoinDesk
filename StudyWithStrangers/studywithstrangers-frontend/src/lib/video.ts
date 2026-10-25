/**
 * Works out what kind of video link the admin gave us. YouTube links are played through YouTube's own player
 * (free, no bandwidth limit however many people watch); anything else is treated as a plain MP4/WebM file.
 */
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else {
        const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/);
        id = m?.[1] ?? null;
      }
    }
    return id && YT_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

export const youTubeEmbedUrl = (id: string, opts: { autoplay?: boolean } = {}) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${opts.autoplay ? "&autoplay=1" : ""}`;
