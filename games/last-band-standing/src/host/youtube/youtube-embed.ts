const YOUTUBE_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const YOUTUBE_EMBED_BASE_URL = "https://www.youtube-nocookie.com/embed";

/**
 * Extracts the start time in seconds from YouTube URLs (t=25, t=1m5s, etc.).
 */
const extractYouTubeStartSeconds = (youtubeUrl: string): number | null => {
  const url = new URL(youtubeUrl, "https://youtube.com");
  const t = url.searchParams.get("t") ?? url.searchParams.get("start");
  if (!t) return null;

  const asNumber = Number.parseInt(t, 10);
  if (!Number.isNaN(asNumber)) return asNumber;

  const match = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!match) return null;
  const [, h, m, s] = match;
  return (
    parseInt(h ?? "0", 10) * 3600 +
    parseInt(m ?? "0", 10) * 60 +
    parseInt(s ?? "0", 10)
  );
};

/**
 * Extracts the canonical 11-character YouTube video id from common URL formats.
 */
export const extractYouTubeVideoId = (youtubeUrl: string): string | null => {
  const match = youtubeUrl.match(YOUTUBE_ID_REGEX);

  if (!match) {
    return null;
  }

  return match[1] ?? null;
};

/**
 * Builds an embeddable YouTube URL with stable defaults for game playback.
 */
export const getYouTubeEmbedUrl = (
  youtubeUrl: string,
  autoplay: boolean,
  clipStartSeconds?: number | null,
): string | null => {
  const videoId = extractYouTubeVideoId(youtubeUrl);

  if (!videoId) {
    return null;
  }

  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    enablejsapi: "1",
    playsinline: "1",
    rel: "0",
  });
  if (typeof window !== "undefined") {
    params.set("origin", window.location.origin);
  }
  const start = clipStartSeconds ?? extractYouTubeStartSeconds(youtubeUrl);
  if (start !== null && start > 0) {
    params.set("start", String(start));
  }
  return `${YOUTUBE_EMBED_BASE_URL}/${videoId}?${params.toString()}`;
};

/**
 * Builds a YouTube embed URL for ambient background use: muted, no controls, autoplay, loop.
 */
export const getYouTubeBackgroundEmbedUrl = (
  youtubeUrl: string,
): string | null => {
  const videoId = extractYouTubeVideoId(youtubeUrl);

  if (!videoId) {
    return null;
  }

  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    showinfo: "0",
    rel: "0",
    loop: "1",
    playlist: videoId,
    playsinline: "1",
  });
  const start = extractYouTubeStartSeconds(youtubeUrl);
  if (start !== null && start > 0) {
    params.set("start", String(start));
  }

  return `${YOUTUBE_EMBED_BASE_URL}/${videoId}?${params.toString()}`;
};
