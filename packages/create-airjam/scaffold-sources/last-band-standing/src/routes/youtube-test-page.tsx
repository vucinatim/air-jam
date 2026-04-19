import { Button } from "@/components/ui/button";
import { extractYouTubeVideoId, getYouTubeEmbedUrl } from "@/features/youtube";
import { useMemo, useState } from "react";

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
    <main className="bg-background text-foreground min-h-screen px-4 py-8">
      <section className="mx-auto w-full max-w-4xl space-y-4">
        <header className="bg-card text-card-foreground rounded-4xl border p-5">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
            Debug
          </p>
          <h1 className="mt-1 text-2xl font-semibold">YouTube Iframe Test</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Load a single YouTube URL to test embed behavior outside the game
            flow.
          </p>
        </header>

        <article className="bg-card text-card-foreground rounded-4xl border p-5">
          <label
            className="mb-2 block text-sm font-medium"
            htmlFor="youtube-url"
          >
            YouTube URL
          </label>
          <input
            id="youtube-url"
            type="text"
            value={inputUrl}
            onChange={(event) => setInputUrl(event.target.value)}
            className="bg-background w-full rounded-3xl border px-4 py-2 text-sm"
            placeholder="https://www.youtube.com/watch?v=..."
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setLoadedUrl(inputUrl.trim())}>
              Load Iframe
            </Button>

            <label className="text-muted-foreground inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(event) => setAutoplay(event.target.checked)}
              />
              Autoplay
            </label>
          </div>

          <div className="text-muted-foreground mt-4 space-y-1 text-xs">
            <p>
              Parsed video id:{" "}
              <span className="font-mono">{videoId ?? "invalid"}</span>
            </p>
            <p>
              Embed URL:{" "}
              <span className="font-mono">{embedUrl ?? "invalid"}</span>
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

        <article className="bg-card text-card-foreground overflow-hidden rounded-4xl border p-4">
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
            <div className="bg-background text-muted-foreground flex h-[520px] items-center justify-center rounded-3xl border text-sm">
              Enter a valid YouTube URL and click Load Iframe.
            </div>
          )}
        </article>
      </section>
    </main>
  );
};
