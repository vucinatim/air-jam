import {
  getYouTubeBackgroundEmbedUrl,
  getYouTubeEmbedUrl,
} from "@/host/youtube/youtube-embed";
import { describe, expect, it } from "vitest";

const expectGamePlayerChromeDisabled = (embedUrl: string | null): URL => {
  expect(embedUrl).not.toBeNull();
  const url = new URL(embedUrl!);

  expect(url.searchParams.get("cc_load_policy")).toBe("0");
  expect(url.searchParams.get("controls")).toBe("0");
  expect(url.searchParams.get("disablekb")).toBe("1");
  expect(url.searchParams.get("fs")).toBe("0");
  expect(url.searchParams.get("iv_load_policy")).toBe("3");

  return url;
};

describe("YouTube embed presentation", () => {
  it("hides player chrome for round playback while preserving API control", () => {
    const url = expectGamePlayerChromeDisabled(
      getYouTubeEmbedUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        true,
        42,
      ),
    );

    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("enablejsapi")).toBe("1");
    expect(url.searchParams.get("start")).toBe("42");
  });

  it("uses the same chrome-free presentation for menu backgrounds", () => {
    const url = expectGamePlayerChromeDisabled(
      getYouTubeBackgroundEmbedUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=15",
      ),
    );

    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("mute")).toBe("1");
    expect(url.searchParams.get("loop")).toBe("1");
    expect(url.searchParams.get("start")).toBe("15");
  });
});
