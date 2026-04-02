import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { extractYouTubeVideoId, getYouTubeEmbedUrl } from "@/features/youtube";

const DEFAULT_URL = "https://www.youtube.com/watch?v=4NRXx6U8ABQ";

export const YoutubeTestPage = () => {
  const [inputUrl, setInputUrl] = useState<string>(DEFAULT_URL);
  const [loadedUrl, setLoadedUrl] = useState<string>(DEFAULT_URL);
  const [autoplay, setAutoplay] = useState<boolean>(true);

  const videoId = useMemo(() => extractYouTubeVideoId(loadedUrl), [loadedUrl]);
  const embedUrl = useMemo(
    () => getYouTubeEmbedUrl(loadedUrl, autoplay),
    [loadedUrl, autoplay],
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto w-full max-w-4xl space-y-4">
        <header className="rounded-4xl border bg-card p-5 text-card-foreground">
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Debug
          </p>
          <h1 className="mt-1 text-2xl font-semibold">YouTube Iframe Test</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Load a single YouTube URL to test embed behavior outside the game flow.
          </p>
        </header>

        <article className="rounded-4xl border bg-card p-5 text-card-foreground">
          <label className="mb-2 block text-sm font-medium" htmlFor="youtube-url">
            YouTube URL
          </label>
          <input
            id="youtube-url"
            type="text"
            value={inputUrl}
            onChange={(event) => setInputUrl(event.target.value)}
            className="w-full rounded-3xl border bg-background px-4 py-2 text-sm"
            placeholder="https://www.youtube.com/watch?v=..."
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setLoadedUrl(inputUrl.trim())}>
              Load Iframe
            </Button>

            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(event) => setAutoplay(event.target.checked)}
              />
              Autoplay
            </label>
          </div>

          <div className="mt-4 space-y-1 text-xs text-muted-foreground">
            <p>
              Parsed video id: <span className="font-mono">{videoId ?? "invalid"}</span>
            </p>
            <p>
              Embed URL: <span className="font-mono">{embedUrl ?? "invalid"}</span>
            </p>
          </div>

          {videoId ? (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Open Watch URL
              </a>
              <a
                href={`https://www.youtube.com/embed/${videoId}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Open Embed URL
              </a>
            </div>
          ) : null}
        </article>

        <article className="overflow-hidden rounded-4xl border bg-card p-4 text-card-foreground">
          {embedUrl ? (
            <iframe
              key={embedUrl}
              title="YouTube iframe test"
              src={embedUrl}
              className="h-[520px] w-full rounded-3xl border"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="flex h-[520px] items-center justify-center rounded-3xl border bg-background text-sm text-muted-foreground">
              Enter a valid YouTube URL and click Load Iframe.
            </div>
          )}
        </article>
      </section>
    </main>
  );
};
