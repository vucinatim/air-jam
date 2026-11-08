import type { ControllerLeasedControlAck } from "@air-jam/sdk/protocol";
import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, vi } from "vitest";
import type { DecisionProvider } from "../src/decision-provider.js";
import {
  GameRunOwner,
  wallClock,
  type GameRunSession,
} from "../src/game-run-owner.js";
import {
  startTestGameRunSchema,
  type AirJamGameRunRecord,
} from "../src/game-run-protocol.js";
import type {
  AirJamPolicyDecision,
  AirJamTestProfileDescription,
} from "../src/testing.js";
import type { CloseGameSessionResult } from "../src/types.js";

const io = vi.hoisted(() => ({
  headless: vi.fn(),
  startPolicy: vi.fn(),
  assertScopes: vi.fn(),
  decide: vi.fn(),
  evaluate: vi.fn(),
  stopEvaluator: vi.fn(),
  stopPolicy: vi.fn(),
  inspectGame: vi.fn(),
  build: vi.fn(),
  verifyBuild: vi.fn(),
  verifyArtifacts: vi.fn(),
}));
export { io };

vi.mock("../src/headless-room.js", () => ({
  startHeadlessRoom: (...args: unknown[]) => io.headless(...args),
}));
vi.mock("../src/policy-artifacts.js", () => ({
  verifyPolicyArtifacts: (...argumentsList: unknown[]) =>
    io.verifyArtifacts(...argumentsList),
}));
vi.mock("../src/managed-process-scope.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/managed-process-scope.js")>()),
  assertProcessScopesConfirmed: () => io.assertScopes(),
}));
vi.mock("../src/test-profile-process.js", () => ({
  startTestProfileProcess: (...args: unknown[]) => io.startPolicy(...args),
}));
vi.mock("../src/game-build.js", () => ({
  sealGameBuild: (...args: unknown[]) => io.build(...args),
  verifyPinnedGameBuild: (...args: unknown[]) => io.verifyBuild(...args),
}));
vi.mock("../src/games.js", () => ({
  inspectGame: (...args: unknown[]) => io.inspectGame(...args),
}));
export const fixtures: Array<{
  owner: GameRunOwner;
  root: string;
  unconfirmed?: boolean;
}> = [];
export const profile: AirJamTestProfileDescription = {
  id: "counter",
  label: "Counter",
  seats: [{ id: "player", label: "Player" }],
  setup: [],
  actions: ["tap"],
  scope: "diagnostic",
  includeImage: false,
  timing: { intervalMs: 20, decisionMs: 50, inputTtlMs: 100 },
  metrics: [],
  policies: [{ id: "code", label: "Code" }],
};
beforeEach(() => {
  vi.resetAllMocks();
  io.build.mockResolvedValue({
    rootDir: "/sealed",
    configPath: "/sealed/src/airjam.config.ts",
    distDir: "/sealed/dist",
    manifestPath: "/sealed/build.json",
    sourceArchivePath: "/sealed/source.zip",
    reused: false,
    manifest: {
      version: 1,
      buildKey: "a".repeat(64),
      sourceHash: "b".repeat(64),
      lockfileHash: "c".repeat(64),
      distHash: "d".repeat(64),
      createdAt: new Date().toISOString(),
      toolchain: {
        node: process.version,
        pnpm: "9.9.0",
        devtools: "test",
        platform: process.platform,
        architecture: process.arch,
        nodeAbi: process.versions.modules,
        projectRoot: "/game",
        implementationHash: "e".repeat(64),
        environmentHash: "f".repeat(64),
      },
      dependencies: {
        installedTreeHash: "7".repeat(64),
        installedLockfileHash: "c".repeat(64),
        installation: {
          durationMs: 0,
          packageCount: 0,
          reused: 0,
          downloaded: 0,
          added: 0,
          stages: [],
        },
      },
      files: [],
      sourceArchive: { bytes: 0, sha256: "0".repeat(64) },
    },
  });
  io.verifyBuild.mockResolvedValue(undefined);
  io.inspectGame.mockResolvedValue({
    id: "test",
    rootDir: "/game",
    configPath: "/game/src/airjam.config.ts",
  });
  io.startPolicy.mockImplementation(async (options) => ({
    profiles: [structuredClone(profile)],
    decide: io.decide,
    evaluate: io.evaluate,
    busy: () => false,
    stop: options.role === "evaluator" ? io.stopEvaluator : io.stopPolicy,
  }));
  io.evaluate.mockResolvedValue({ status: "pending" });
  io.stopEvaluator.mockResolvedValue(undefined);
  io.stopPolicy.mockResolvedValue(undefined);
  io.decide.mockResolvedValue({ control: { kind: "release" } });
});
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    try {
      if (fixture.unconfirmed)
        await expect(fixture.owner.drain()).rejects.toThrow(
          /run_cleanup_unconfirmed|process_scope_unavailable|process_tree_unconfirmed/,
        );
      else await fixture.owner.drain();
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

export async function fixture({
  decisions,
}: { decisions?: DecisionProvider["ask"] } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-run-"));
  const events: string[] = [];
  const session: GameRunSession = {
    clock: wallClock,
    watch: vi.fn(async () => {}),
    watchHost: vi.fn(async () => {}),
    summary: {
      ownerInstanceId: randomUUID(),
      semanticAccess: "owned-host",
      gameSessionId: randomUUID(),
      cwd: root,
      gameId: "test",
      controllerSessionId: randomUUID(),
      projectMode: "standalone-game",
      mode: "standalone-dev",
      topologyMode: "standalone-dev",
      secure: false,
      process: null,
      roomId: "ROOM",
      controllerId: "player",
      deviceId: "device-player",
      controllerJoinUrl: "http://localhost/controller?room=ROOM",
      socketOrigin: "http://localhost",
      connected: true,
      connectedAt: new Date().toISOString(),
      disconnectedAt: null,
      disconnectReason: null,
      hasAgentContract: true,
      actions: [],
    },
    readParticipants: vi.fn(async () => ({
      roomId: "ROOM",
      controllerIds: ["player"],
    })),
    checkConnected: vi.fn(async () => {}),
    observe: vi.fn(async (options) => {
      events.push(options.includeImage ? "final-observation" : "observation");
      return {
        version: 1,
        id: randomUUID(),
        identity: {
          documentId: "doc",
          roomId: "ROOM",
          contractId: "contract",
          runtimeId: "runtime",
          surfaceId: "surface",
          participantId: "receiver",
        },
        sequence: events.length,
        scope: options.scope,
        controllerId: "player",
        host: {
          before: { runtimeState: "playing", connectionStatus: "connected" },
          after: { runtimeState: "playing", connectionStatus: "connected" },
        },
        capturedAt: new Date().toISOString(),
        clock: {
          startedAtMs: performance.now(),
          finishedAtMs: performance.now(),
        },
        durationMs: 0,
        snapshot: { totalCount: 0 },
        runtime: null,
        ticks: { before: events.length, after: events.length },
        // A host that renders ten frames and simulates a quarter second per real second.
        pace: {
          frames: events.length * 10,
          wallMs: events.length * 1000,
          simulatedMs: events.length * 250,
        },
        stores: { before: [], after: [] },
        visual: { status: "unavailable", reason: "unsupported" },
      } satisfies HostObservation;
    }),
    control: vi.fn(async (request) => {
      events.push(request.operation.kind);
      const operation =
        request.operation.kind === "action"
          ? {
              kind: "action" as const,
              result: {
                ok: true as const,
                status: "accepted" as const,
                source: "host" as const,
              },
            }
          : { kind: request.operation.kind };
      return {
        status: "applied",
        leaseId: request.lease.id,
        sequence: request.lease.sequence,
        replayed: false,
        operation,
      } satisfies ControllerLeasedControlAck;
    }),
    addParticipant: vi.fn(async () => {
      throw new Error("No extra participant requested.");
    }),
    invokeHost: vi.fn(),
    close: vi.fn(async () => {
      events.push("close");
      return {
        closed: true,
        session: { ...session.summary, connected: false },
        disconnection: {
          release: { status: "not-leased" },
          leave: { status: "acknowledged" },
        },
      } satisfies CloseGameSessionResult;
    }),
    forceClose: vi.fn(async () => {
      throw new Error("Normal teardown should succeed.");
    }),
  };
  const openSession = vi.fn(async () => session);
  const sessionClosed = vi.fn(() => events.push("forgot-session"));
  const owner = new GameRunOwner({
    projectDir: root,
    ownerInstanceId: randomUUID(),
    openSession,
    sessionClosed,
    decisions: decisions && { model: "test-model", ask: decisions },
  });
  fixtures.push({ owner, root });
  const request: import("zod").input<typeof startTestGameRunSchema> = {
    runId: randomUUID(),
    profileId: "counter",
    policyId: "code",
    target: { kind: "owned" },
    budget: { durationMs: 5000, steps: 100 },
  };
  const ended = async (): Promise<AirJamGameRunRecord> => {
    await vi.waitFor(async () =>
      expect((await owner.read(request.runId)).state).toBe("ended"),
    );
    return owner.read(request.runId);
  };
  return {
    root,
    events,
    session,
    openSession,
    owner,
    request,
    ended,
    sessionClosed,
  };
}

export const attachment = (controllerIds = ["player"]) => ({
  controllerJoinUrl:
    "http://localhost/controller?room=ROOM&aj_controller_cap=never-persist-this",
  controllerIds,
  host: {
    endpoint: "https://private-host.invalid/request",
    targetId: "ephemeral-target",
  },
});

export const tapOrWait = {
  ask: {
    state: ["A shared counter. Tap until it reaches six."],
    question: "Should I tap now?",
    options: {
      tap: {
        when: "The count is below six.",
        control: { kind: "action", actionId: "tap" },
      },
      wait: {
        when: "The count has reached six.",
        control: { kind: "input", input: { direction: 0 } },
      },
    },
  },
} satisfies AirJamPolicyDecision;
