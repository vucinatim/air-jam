import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { SoundManifest } from "../src/audio/audio-manager";
import { defineAirJamAssets } from "../src/core/assets";
import { defineAirJamGame } from "../src/core/game";
import { defineAirJamTheme } from "../src/core/theme";
import { defineAirJamGameMetadata } from "../src/metadata";
import { createAirJamApp } from "../src/runtime/create-air-jam-app";

const { audio } = vi.hoisted(() => ({ audio: vi.fn() }));
vi.mock("../src/audio/hooks", () => ({
  AudioRuntime: ({
    manifest,
    children,
  }: {
    manifest: SoundManifest;
    children: ReactNode;
  }) => {
    audio(manifest);
    return children;
  },
}));
vi.mock("../src/runtime/session-runtimes", () => ({
  AirJamHostRuntime: ({ children }: { children: ReactNode }) => children,
  AirJamControllerRuntime: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../src/runtime/connected-runtime-error-boundary", () => ({
  ConnectedRuntimeErrorBoundary: ({ children }: { children: ReactNode }) =>
    children,
}));

it("mounts only each surface's sounds and emits theme variables on the first render", () => {
  const app = createAirJamApp(
    defineAirJamGame({
      metadata: defineAirJamGameMetadata({
        slug: "fixture",
        name: "Fixture",
        tagline: "Fixture",
        category: "arcade",
        minPlayers: 1,
        maxPlayers: 4,
        inputModalities: ["buttons"],
        supportedSdkRange: "^1.0.0",
        maintainer: { name: "Air Jam" },
      }),
      assets: defineAirJamAssets({
        sounds: {
          shared: { src: ["/shared.wav"] },
          music: { src: ["/music.mp3"], surface: "host" },
          click: { src: ["/click.wav"], surface: "controller" },
        },
        images: {},
        files: {},
      }),
      theme: defineAirJamTheme({
        colors: { teamAccent: "#f97316" },
        fonts: { display: '"Avenir Next", sans-serif' },
      }),
    }),
  );
  for (const [Surface, soundIds] of [
    [app.Host, ["shared", "music"]],
    [app.Controller, ["shared", "click"]],
  ] as const) {
    audio.mockClear();
    const markup = renderToStaticMarkup(
      createElement(Surface, { children: "Game" }),
    );
    expect(markup).toContain("--airjam-color-team-accent:#f97316;");
    expect(markup).toContain(
      '--airjam-font-display:"Avenir Next", sans-serif;',
    );
    expect(markup.indexOf("<style>")).toBeLessThan(markup.indexOf("Game"));
    expect(audio).toHaveBeenCalledTimes(1);
    expect(Object.keys(audio.mock.calls[0][0])).toEqual(soundIds);
  }
});
