import { replayAirJamInputLog, type AirJamInputLog } from "@air-jam/sdk/core";
import { expect, it, vi } from "vitest";

it.each([false, true])(
  "changes the ball from 600 to 700 and replays exactly (trailing settings: %s)",
  async (trailingSettings) => {
    const loadGame = async () => {
      vi.resetModules();
      return import("../../../src/airjam.config");
    };
    const { airjam } = await loadGame();
    const live = await replayAirJamInputLog(
      (dependencies, options) =>
        airjam.createHostRuntime(dependencies, { ...options, record: true }),
      {
        version: 2,
        seed: 7,
        settings: { ballSpeed: 600 },
        stepMs: 1000 / 60,
        ticks: 0,
        storeDomain: "default",
        entries: [],
      },
    );
    let log: AirJamInputLog;
    let final: unknown;
    try {
      const { pongStore } = await import("../../../src/game/stores/pong-store");
      await pongStore.actions.setBotCount({ team: "team1", count: 1 });
      await pongStore.actions.setBotCount({ team: "team2", count: 1 });
      await pongStore.actions.startMatch();
      const clock = live.runtime.simulation;
      if (!clock) throw new Error("Pong requires its simulation.");
      for (let tick = 0; tick < 185; tick++) clock.advance(clock.stepMs);
      const read = () =>
        live.agent({
          operation: "observe",
          roomId: live.roomId,
          controllerId: null,
          scope: "diagnostic",
          includeImage: false,
        });
      const before = await read();
      if (before.operation !== "observe")
        throw new Error("Expected observation.");
      expect(before.observation.runtime).toMatchObject({
        countdown: null,
        simulation: { ballVX: expect.any(Number) },
      });
      const speed = (observation: typeof before.observation) =>
        Math.abs(
          (observation.runtime as { simulation: { ballVX: number } }).simulation
            .ballVX,
        );
      expect(speed(before.observation)).toBe(600);
      const settings = await live.agent({
        operation: "settings-read",
        roomId: live.roomId,
        runtimeId: before.observation.identity.runtimeId,
      });
      expect(settings).toMatchObject({
        values: { ballSpeed: 600 },
        revision: 0,
      });
      await live.agent({
        operation: "settings-update",
        roomId: live.roomId,
        runtimeId: before.observation.identity.runtimeId,
        patch: { ballSpeed: 700 },
        expectedRevision: 0,
      });
      clock.advance(clock.stepMs);
      const faster = await read();
      if (faster.operation !== "observe")
        throw new Error("Expected observation.");
      expect(speed(faster.observation)).toBe(700);
      for (let tick = 0; tick < 90; tick++) clock.advance(clock.stepMs);
      if (trailingSettings)
        live.runtime.updateSettings({ paddleSpeed: 800 }, 1);
      const response = await read();
      if (response.operation !== "observe")
        throw new Error("Expected observation.");
      final = {
        snapshot: response.observation.snapshot,
        runtime: response.observation.runtime,
      };
      log = live.runtime.inputLog();
      expect(log).toMatchObject({ version: 2, settings: { ballSpeed: 600 } });
      expect(
        log.entries.filter(
          ({ event, payload }) =>
            event === "airjam:settings" && payload.revision === 1,
        ),
      ).toEqual([
        {
          tick: 186,
          event: "airjam:settings",
          payload: { patch: { ballSpeed: 700 }, revision: 1 },
        },
      ]);
    } finally {
      live.stop();
    }
    const replayGame = await loadGame();
    const replay = await replayAirJamInputLog(
      replayGame.airjam.createHostRuntime,
      JSON.parse(JSON.stringify(log)),
    );
    try {
      const response = await replay.agent({
        operation: "observe",
        roomId: replay.roomId,
        controllerId: null,
        scope: "diagnostic",
        includeImage: false,
      });
      if (response.operation !== "observe")
        throw new Error("Expected observation.");
      expect({
        snapshot: response.observation.snapshot,
        runtime: response.observation.runtime,
      }).toEqual(final);
      expect(replay.runtime.settings.read()).toMatchObject({
        values: { ballSpeed: 700 },
        revision: trailingSettings ? 2 : 1,
      });
      if (trailingSettings)
        expect(replay.runtime.settings.read().values.paddleSpeed).toBe(800);
    } finally {
      replay.stop();
    }
  },
);
