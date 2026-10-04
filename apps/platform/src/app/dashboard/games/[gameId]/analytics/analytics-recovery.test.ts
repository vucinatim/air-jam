// @vitest-environment jsdom

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameAnalyticsPage from "./page";

const { readGame, readOverview, readSessions, readDebug } = vi.hoisted(() => ({
  readGame: vi.fn(),
  readOverview: vi.fn(),
  readSessions: vi.fn(),
  readDebug: vi.fn(),
}));
const totals = {
  sessionCount: 5,
  totalGameActiveSeconds: 180,
  totalControllerSeconds: 360,
  totalRawEligiblePlaytimeSeconds: 120,
  totalEligiblePlaytimeSeconds: 120,
  guardedSessionCount: 0,
  peakConcurrentControllers: 2,
  lastActivityAt: null,
};
const overview = { daily: [{ ...totals, bucketDate: "2026-10-04" }], totals };
const emptyOverview = {
  daily: [],
  totals: {
    ...totals,
    sessionCount: 0,
    totalGameActiveSeconds: 0,
    totalControllerSeconds: 0,
    totalRawEligiblePlaytimeSeconds: 0,
    totalEligiblePlaytimeSeconds: 0,
    peakConcurrentControllers: 0,
  },
};
const debug = {
  runtimeSessionId: null,
  roomId: null,
  sessionStartedAt: null,
  rawEventCount: 0,
  latestEventAt: null,
  latestMetricUpdatedAt: null,
  openSegmentCounts: { controller: 0, game: 0, eligible: 0 },
  totalSegmentCounts: { controller: 0, game: 0, eligible: 0 },
  latestSessionMetric: null,
  recentEvents: [],
};
vi.mock("next/navigation", () => ({ useParams: () => ({ gameId: "game-1" }) }));
vi.mock("@/trpc/react", () => ({
  api: {
    game: {
      get: {
        useQuery: () =>
          useQuery({ queryKey: ["game"], queryFn: () => readGame() }),
      },
    },
    analytics: {
      getGameOverview: {
        useQuery: () =>
          useQuery({ queryKey: ["overview"], queryFn: () => readOverview() }),
      },
      getRecentGameSessions: {
        useQuery: () =>
          useQuery({ queryKey: ["sessions"], queryFn: () => readSessions() }),
      },
      getGameDebugSnapshot: {
        useQuery: () =>
          useQuery({ queryKey: ["debug"], queryFn: () => readDebug() }),
      },
    },
  },
}));

describe("creator analytics recovery", () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    readGame.mockResolvedValue({ id: "game-1", name: "Pong" });
    readOverview.mockResolvedValue(overview);
    readSessions.mockResolvedValue([]);
    readDebug.mockResolvedValue(debug);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["game"], { id: "game-1", name: "Pong" });
    client.setQueryData(["overview"], overview);
    client.setQueryData(["sessions"], []);
    client.setQueryData(["debug"], debug);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
  });
  const render = () =>
    act(() =>
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(
            TooltipProvider,
            null,
            createElement(GameAnalyticsPage),
          ),
        ),
      ),
    );
  const flush = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const retry = () =>
    act(() => {
      const button = Array.from(container.querySelectorAll("button")).find(
        (candidate) => candidate.textContent === "Try again",
      );
      if (!button) throw new Error("Analytics retry button is missing.");
      button.click();
    });
  const openDebug = () =>
    act(() => {
      const button = Array.from(container.querySelectorAll("button")).find(
        (candidate) => candidate.textContent?.includes("Pipeline Debug"),
      );
      if (!button) throw new Error("Debug control is missing.");
      button.click();
    });

  it("does not replace a failed overview with zero activity and supports retry", async () => {
    client.removeQueries({ queryKey: ["overview"] });
    readOverview.mockRejectedValueOnce(new Error("Overview unavailable."));
    render();
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn’t load",
    );
    expect(container.textContent).not.toContain("No activity yet");
    expect(container.textContent).not.toContain("Session Cadence");
    retry();
    await flush();
    expect(readOverview).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Session Cadence");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("retains cached analytics when a background refresh fails", async () => {
    render();
    readOverview.mockRejectedValueOnce(new Error("Refresh unavailable."));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["overview"] });
    });
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Previously loaded",
    );
    expect(container.textContent).toContain("Session Cadence");
    expect(container.textContent).toContain("2m");
    expect(container.textContent).not.toContain("No activity yet");
  });

  it("distinguishes failed session history from an empty history", async () => {
    client.removeQueries({ queryKey: ["sessions"] });
    readSessions.mockRejectedValueOnce(new Error("Sessions unavailable."));
    render();
    await flush();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Last 0 completed sessions");
    expect(container.textContent).not.toContain("No completed sessions yet");
    expect(container.textContent).toContain("Session history is unavailable");
    retry();
    await flush();
    expect(container.textContent).toContain("No completed sessions yet");
    expect(client.getQueryData(["overview"])).toEqual(overview);
  });

  it("distinguishes debug read failure from no recorded runtime session", async () => {
    client.removeQueries({ queryKey: ["debug"] });
    readDebug.mockRejectedValueOnce(new Error("Debug unavailable."));
    render();
    await flush();
    openDebug();
    await flush();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain(
      "No analytics session has been recorded",
    );
    expect(container.textContent).toContain("Pipeline details are unavailable");
    retry();
    await flush();
    expect(container.textContent).toContain(
      "No analytics session has been recorded",
    );
  });

  it("shows empty activity only after a successful overview read", async () => {
    client.setQueryData(["overview"], emptyOverview);
    render();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain(
      "Start a game session to see analytics",
    );
    expect(container.textContent).not.toContain("Session Cadence");
  });

  it("offers retry rather than claiming a game is missing after its read fails", async () => {
    client.removeQueries({ queryKey: ["game"] });
    readGame.mockRejectedValueOnce(new Error("Game unavailable."));
    render();
    await flush();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Game not found");
    retry();
    await flush();
    expect(container.textContent).toContain("Last 30 days for Pong");
  });
});
