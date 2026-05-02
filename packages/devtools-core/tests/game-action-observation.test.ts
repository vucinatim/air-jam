import { describe, expect, it } from "vitest";
import {
  classifyGameActionOutcome,
  computeGameSnapshotObservation,
  isHostAcknowledgementObservationGap,
} from "../src/game-action-observation.js";
import type { AirJamGameSnapshotInspection } from "../src/types.js";

const createSnapshot = (
  overrides?: Partial<AirJamGameSnapshotInspection>,
): AirJamGameSnapshotInspection => ({
  controllerSessionId: "controller-session-1",
  gameId: "fixture-game",
  snapshotStoreDomains: ["default"],
  snapshotDescription: null,
  actions: [],
  snapshot: {
    phase: "lobby",
    score: 0,
  },
  rawStores: [
    {
      storeDomain: "default",
      data: {
        phase: "lobby",
        score: 0,
      },
      updatedAt: "2026-04-28T00:00:00.000Z",
      revision: 0,
    },
  ],
  ...overrides,
});

describe("game action observation helpers", () => {
  it("treats host ack timeout and missing as acknowledgement observation gaps", () => {
    expect(
      isHostAcknowledgementObservationGap({
        ok: false,
        status: "rejected",
        source: "server",
        reason: "host_ack_timeout",
        message: "timed out",
      }),
    ).toBe(true);

    expect(
      isHostAcknowledgementObservationGap({
        ok: false,
        status: "rejected",
        source: "server",
        reason: "host_ack_missing",
        message: "missing",
      }),
    ).toBe(true);

    expect(
      isHostAcknowledgementObservationGap({
        ok: false,
        status: "rejected",
        source: "host",
        reason: "phase_locked",
        message: "locked",
      }),
    ).toBe(false);
  });

  it("detects committed snapshots and real state changes separately", () => {
    const before = createSnapshot();
    const after = createSnapshot({
      snapshot: {
        phase: "playing",
        score: 1,
      },
      rawStores: [
        {
          storeDomain: "default",
          data: {
            phase: "playing",
            score: 1,
          },
          updatedAt: "2026-04-28T00:00:01.000Z",
          revision: 1,
        },
      ],
    });

    expect(
      computeGameSnapshotObservation({
        snapshotBefore: before,
        snapshotAfter: after,
      }),
    ).toEqual({
      snapshotAfterStatus: "committed-update-observed",
      observedStateChange: true,
    });
  });

  it("distinguishes ack gaps with state change from ack gaps without observed change", () => {
    expect(
      classifyGameActionOutcome({
        acknowledgement: {
          ok: false,
          status: "rejected",
          source: "server",
          reason: "host_ack_missing",
          message: "missing",
        },
        observedStateChange: true,
      }),
    ).toEqual({
      acknowledgementObservation: "host-acknowledgement-not-observed",
      outcome: "acknowledgement-not-observed-state-changed",
    });

    expect(
      classifyGameActionOutcome({
        acknowledgement: {
          ok: false,
          status: "rejected",
          source: "server",
          reason: "host_ack_missing",
          message: "missing",
        },
        observedStateChange: false,
      }),
    ).toEqual({
      acknowledgementObservation: "host-acknowledgement-not-observed",
      outcome: "acknowledgement-not-observed-no-state-change-observed",
    });
  });

  it("keeps normal accepted and rejected results on the acknowledged lane", () => {
    expect(
      classifyGameActionOutcome({
        acknowledgement: {
          ok: true,
          status: "accepted",
          source: "host",
        },
        observedStateChange: false,
      }),
    ).toEqual({
      acknowledgementObservation: "host-acknowledged",
      outcome: "accepted",
    });

    expect(
      classifyGameActionOutcome({
        acknowledgement: {
          ok: false,
          status: "rejected",
          source: "host",
          reason: "phase_locked",
          message: "locked",
        },
        observedStateChange: false,
      }),
    ).toEqual({
      acknowledgementObservation: "host-acknowledged",
      outcome: "rejected",
    });
  });
});
