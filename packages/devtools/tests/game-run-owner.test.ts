import type { ControllerLeasedControlAck } from "@air-jam/sdk/protocol";
import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DecisionProvider } from "../src/decision-provider.js";
import { GameRunOwner, type GameRunSession } from "../src/game-run-owner.js";
import {
  MAXIMUM_GAME_RUN_TRACE_BYTES,
  type StartGameRunOptions,
} from "../src/game-run-protocol.js";
import { readTerminalGameRun } from "../src/game-run-record.js";
import type {
  AirJamPolicyDecision,
  AirJamTestProfileDescription,
} from "../src/testing.js";
import { createAirJamPlayerPolicy } from "../src/testing.js";
import type { CloseGameSessionResult } from "../src/types.js";

const io = vi.hoisted(() => ({
  startPolicy: vi.fn(),
  assertScopes: vi.fn(),
  decide: vi.fn(),
  evaluate: vi.fn(),
  stopEvaluator: vi.fn(),
  stopPolicy: vi.fn(),
  games: vi.fn(),
  build: vi.fn(),
  verifyBuild: vi.fn(),
  verifyArtifacts: vi.fn(),
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
  listGames: (...args: unknown[]) => io.games(...args),
}));
const fixtures: Array<{
  owner: GameRunOwner;
  root: string;
  unconfirmed?: boolean;
}> = [];
const profile: AirJamTestProfileDescription = {
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
  vi.clearAllMocks();
  io.assertScopes.mockReset();
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
  io.games.mockResolvedValue([
    { id: "test", rootDir: "/game", configPath: "/game/src/airjam.config.ts" },
  ]);
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

async function fixture({
  decisions,
}: { decisions?: DecisionProvider["ask"] } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-run-"));
  const events: string[] = [];
  const session: GameRunSession = {
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
  const request: StartGameRunOptions = {
    runId: randomUUID(),
    profileId: "counter",
    policyId: "code",
    target: { kind: "owned" },
    budget: { durationMs: 5000, steps: 100 },
  };
  const ended = async () => {
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

const attachment = (controllerIds = ["player"]) => ({
  controllerJoinUrl:
    "http://localhost/controller?room=ROOM&aj_controller_cap=never-persist-this",
  controllerIds,
  host: {
    endpoint: "https://private-host.invalid/request",
    targetId: "ephemeral-target",
  },
});

it("joins the creator's room alongside humans and keeps access out of records and traces", async () => {
  const f = await fixture();
  const currentProfile: AirJamTestProfileDescription = {
    ...profile,
    scope: "player",
  };
  io.startPolicy.mockImplementation(async (options) => ({
    profiles: [currentProfile],
    decide: io.decide,
    evaluate: io.evaluate,
    busy: () => false,
    stop: options.role === "evaluator" ? io.stopEvaluator : io.stopPolicy,
  }));
  f.request.target = { kind: "current" };
  f.session.summary.semanticAccess = "delegated-host";
  vi.mocked(f.session.readParticipants).mockResolvedValue({
    roomId: "ROOM",
    controllerIds: ["human", "player"],
  });
  const granted = attachment();
  await f.owner.start(f.request, granted);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalled());
  await expect(
    f.owner.watch(
      { runId: f.request.runId, surface: { kind: "host" } },
      () => {},
      new AbortController().signal,
    ),
  ).rejects.toThrow("active owned");
  const retry = await f.owner.start(f.request, attachment(["another"]));
  expect(retry.state).not.toBe("ended");
  expect(f.openSession).toHaveBeenCalledOnce();
  expect(f.openSession).toHaveBeenCalledWith({
    runId: f.request.runId,
    gameId: undefined,
    nickname: "Agent 1",
    attachment: granted,
    build: undefined,
    onScope: expect.any(Function),
  });
  const record = await f.owner.stop(f.request.runId);
  expect(record.cleanup?.participantsClosed).toBe(true);
  expect(f.session.addParticipant).not.toHaveBeenCalled();
  const directory = path.join(
    f.root,
    ".airjam",
    "artifacts",
    "runs",
    f.request.runId,
  );
  for (const name of ["record.json", "trace.ndjson"]) {
    const content = await readFile(path.join(directory, name), "utf8");
    expect(content).not.toMatch(
      /never-persist-this|ephemeral-target|private-host/,
    );
  }
});

it("refuses current-room admission without delegated access and refuses access on owned tests", async () => {
  const f = await fixture();
  await expect(
    f.owner.start({ ...f.request, target: { kind: "current" } }),
  ).rejects.toThrow("current_attachment_required");
  await expect(f.owner.start(f.request, attachment())).rejects.toThrow(
    "unexpected_attachment",
  );
  expect(f.openSession).not.toHaveBeenCalled();
});

it("refuses a profile that needs more seats than the creator's room issued", async () => {
  const f = await twoSeatFixture();
  f.request.target = { kind: "current" };
  await f.owner.start(f.request, attachment());
  const record = await f.ended();
  expect(record.end?.message).toContain("current_profile_invalid");
  expect(f.openSession).not.toHaveBeenCalled();
});

it("seats several agents in the creator's room and runs host setup through it", async () => {
  const f = await twoSeatFixture();
  io.startPolicy.mockImplementation(async (options) => ({
    profiles: [
      {
        ...structuredClone(profile),
        seats: [
          { id: "left", label: "Left" },
          { id: "right", label: "Right" },
        ],
        setup: [{ lane: "host", actionId: "start_round" }],
      },
    ],
    decide: io.decide,
    evaluate: io.evaluate,
    busy: () => false,
    stop: options.role === "evaluator" ? io.stopEvaluator : io.stopPolicy,
  }));
  f.request.target = { kind: "current" };
  f.session.summary.semanticAccess = "delegated-host";
  f.session.readParticipants = vi.fn(async () => ({
    roomId: "ROOM",
    controllerIds: ["human", "player", "second"],
  }));
  io.decide.mockResolvedValue({ control: { kind: "action", actionId: "tap" } });
  passAfterEffect("Both seats played.");
  await f.owner.start(f.request, attachment(["player", "second"]));
  const record = await f.ended();
  expect(record.end?.outcome).toBe("passed");
  expect(f.session.addParticipant).toHaveBeenCalledOnce();
  expect(f.session.invokeHost).toHaveBeenCalledWith("start_round", undefined);
  expect(record.seats.map((seat) => seat.controllerId)).toEqual([
    "player",
    "second",
  ]);
});

async function twoSeatFixture() {
  const f = await fixture();
  const twoSeats = {
    ...structuredClone(profile),
    seats: [
      { id: "left", label: "Left" },
      { id: "right", label: "Right" },
    ],
  };
  io.startPolicy.mockImplementation(async (options) => ({
    profiles: [twoSeats],
    decide: io.decide,
    evaluate: io.evaluate,
    busy: () => false,
    stop: options.role === "evaluator" ? io.stopEvaluator : io.stopPolicy,
  }));
  const extra = {
    watch: vi.fn(async () => {}),
    controllerId: "second",
    checkConnected: vi.fn(async () => {}),
    observe: vi.fn(
      async (options: Parameters<typeof f.session.observe>[0]) => ({
        ...(await f.session.observe(options)),
        controllerId: "second",
      }),
    ),
    control: vi.fn(f.session.control),
    close: vi.fn(async () => {
      f.events.push("extra-left");
      return {
        release: { status: "not-leased" as const },
        leave: { status: "acknowledged" as const },
      };
    }),
    forceClose: vi.fn(),
  };
  f.session.addParticipant = vi.fn(async () => extra);
  f.session.readParticipants = vi.fn(async () => ({
    roomId: "ROOM",
    controllerIds: ["player", "second"],
  }));
  return { ...f, extra };
}

function passAfterEffect(message: string) {
  let tested = false;
  io.evaluate.mockImplementation(async (sample) => {
    tested ||= sample.receipts.some(
      (receipt: { phase: string; operation: { kind: string } }) =>
        receipt.phase === "play" && receipt.operation.kind !== "release",
    );
    return { status: tested ? "passed" : "pending", message };
  });
}

it("owns one fresh session, retains the final actual observation before teardown and records acknowledged cleanup", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({
    control: { kind: "action", actionId: "tap" },
  } satisfies AirJamPolicyDecision);
  passAfterEffect("Observed the expected count.");
  expect((await f.owner.start(f.request)).state).toBe("starting");
  const record = await f.ended();
  expect(f.openSession).toHaveBeenCalledOnce();
  expect(record.end).toEqual({
    reason: "completed",
    outcome: "passed",
    message: "Observed the expected count.",
  });
  expect(record.cleanup).toMatchObject({
    seats: [{ seatId: "player", release: { status: "applied" } }],
    close: {
      closed: true,
      disconnection: { leave: { status: "acknowledged" } },
    },
    errors: [],
  });
  expect(f.events.indexOf("final-observation")).toBeLessThan(
    f.events.indexOf("close"),
  );
  expect(f.events.slice(-2)).toEqual(["close", "forgot-session"]);
  expect(record.evidence?.observation?.sha256).toHaveLength(64);
  const source = await readFile(
    path.join(
      f.root,
      ".airjam/artifacts/runs",
      f.request.runId,
      "final-observation.json",
    ),
    "utf8",
  );
  expect(JSON.parse(source).identity.documentId).toBe("doc");
  expect(record.counters).toMatchObject({
    steps: 1,
    rejected: 0,
    unconfirmed: 0,
  });
  expect((await f.owner.stop(f.request.runId)).end?.reason).toBe("completed");
  expect(f.session.close).toHaveBeenCalledOnce();
});

it("verifies declared artifacts in the owner before actor startup and retains only that trusted receipt", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({ control: { kind: "action", actionId: "tap" } });
  const manifest = {
    version: 1,
    provenance: { model: "Pinned checkpoint" },
    files: [{ path: "weights", bytes: 4, sha256: "a".repeat(64) }],
  };
  const artifacts = {
    directory: "/models/verified",
    receipt: { manifestSha256: "b".repeat(64), manifest, verifyMs: 1 },
  };
  io.verifyArtifacts.mockResolvedValue(artifacts);
  io.startPolicy.mockImplementation(async (options) => {
    if (options.role === "policy") {
      expect(io.verifyArtifacts).toHaveBeenCalledOnce();
      expect(options.artifacts).toEqual(artifacts);
    } else expect(options.artifacts).toBeUndefined();
    return {
      profiles: [
        {
          ...structuredClone(profile),
          policies: [
            {
              id: "code",
              label: "Code",
              artifacts: "src/testing/model.lock.json",
            },
          ],
        },
      ],
      preparation: [{ seatId: "player", prepareMs: 2 }],
      decide: io.decide,
      evaluate: io.evaluate,
      busy: () => false,
      stop: options.role === "evaluator" ? io.stopEvaluator : io.stopPolicy,
    };
  });
  passAfterEffect("Done");
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.policyArtifacts).toEqual(artifacts.receipt);
  expect(record.policyInitializationMs).toBeGreaterThanOrEqual(0);
  expect(io.verifyArtifacts).toHaveBeenCalledWith(
    expect.objectContaining({
      projectDir: "/sealed",
      manifestPath: "/sealed/src/testing/model.lock.json",
    }),
  );
});

it("keeps policy diagnostics in the trace and never forwards them to game controls or judging", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({
    control: { kind: "action", actionId: "tap" },
    diagnostics: { candidate: "up", confidence: 0.7 },
  });
  passAfterEffect("Done");
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.policyArtifacts).toBeUndefined();
  expect(io.verifyArtifacts).not.toHaveBeenCalled();
  const trace = await readFile(
    path.join(
      f.root,
      ".airjam/artifacts/runs",
      f.request.runId,
      "trace.ndjson",
    ),
    "utf8",
  );
  expect(trace).toContain('"candidate":"up"');
  expect(JSON.stringify(io.evaluate.mock.calls)).not.toContain('"candidate"');
  expect(JSON.stringify(vi.mocked(f.session.control).mock.calls)).not.toContain(
    '"candidate"',
  );
});

it("deduplicates concurrent admissions, rejects changed requests and never reuses a previous owner's run ID", async () => {
  const f = await fixture();
  await Promise.all([f.owner.start(f.request), f.owner.start(f.request)]);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalled());
  expect(f.openSession).toHaveBeenCalledOnce();
  await expect(f.owner.start({ ...f.request, seed: 99 })).rejects.toThrow(
    "run_conflict",
  );
  await f.owner.stop(f.request.runId);
  const other = new GameRunOwner({
    projectDir: f.root,
    ownerInstanceId: randomUUID(),
    openSession: f.openSession,
    sessionClosed: f.sessionClosed,
  });
  expect((await other.read(f.request.runId)).end?.reason).toBe("stopped");
  await expect(other.start(f.request)).rejects.toThrow("run_id_reused");
  expect(f.openSession).toHaveBeenCalledOnce();
  await other.drain();
});

it("Stop during startup waits for a late session, closes it exactly once and starts no decision", async () => {
  const f = await fixture();
  let finishOpen: (session: GameRunSession) => void = () => {
    throw new Error("Open was not pending.");
  };
  f.openSession.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishOpen = resolve;
      }),
  );
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(f.openSession).toHaveBeenCalledOnce());
  const stopped = f.owner.stop(f.request.runId);
  const alsoStopped = f.owner.stop(f.request.runId);
  finishOpen(f.session);
  const [first, second] = await Promise.all([stopped, alsoStopped]);
  expect(first).toEqual(second);
  expect(first.end?.reason).toBe("stopped");
  expect(io.decide).not.toHaveBeenCalled();
  expect(f.session.close).toHaveBeenCalledOnce();
});

it("never applies a policy decision that arrives after Stop, without waiting for the policy to cooperate", async () => {
  const f = await fixture();
  let decide: (value: AirJamPolicyDecision) => void = () => {
    throw new Error("Decision was not pending.");
  };
  io.decide.mockImplementation(
    () =>
      new Promise((resolve) => {
        decide = resolve;
      }),
  );
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalledOnce());
  await f.owner.stop(f.request.runId);
  decide({ control: { kind: "input", input: { direction: 1 } } });
  await new Promise((resolve) => setImmediate(resolve));
  expect(f.events).not.toContain("input");
  expect(io.stopPolicy).toHaveBeenCalledOnce();
  expect(f.session.close).toHaveBeenCalledOnce();
});

it("fences a replacement receiver before taking another action", async () => {
  const f = await fixture();
  const observe = f.session.observe;
  let count = 0;
  f.session.observe = vi.fn(async (options) => {
    const value = await observe(options);
    if (++count > 1) value.identity.participantId = "replacement";
    return value;
  });
  await f.owner.start(f.request);
  expect((await f.ended()).end?.reason).toBe("runtime_replaced");
  expect(io.decide).not.toHaveBeenCalled();
  expect(f.session.close).toHaveBeenCalledOnce();
});

it("refuses policy actions outside the scenario instead of falling back to ordinary RPC", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({
    control: { kind: "action", actionId: "reset_counter" },
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end).toMatchObject({
    reason: "error",
    outcome: "inconclusive",
    message: expect.stringContaining("policy_action_forbidden"),
  });
  expect(f.events).not.toContain("action");
});

it("still disconnects after final capture fails, and preserves the failure instead of manufacturing evidence", async () => {
  const f = await fixture();
  const observe = f.session.observe;
  f.session.observe = vi.fn((options) =>
    options.includeImage
      ? Promise.reject(new Error("surface unavailable"))
      : observe(options),
  );
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalled());
  const record = await f.owner.stop(f.request.runId);
  expect(record.evidence).toMatchObject({
    observation: null,
    error: "surface unavailable",
  });
  expect(record.cleanup?.close?.closed).toBe(true);
});

it("releases on missed decisions and ends an unresponsive policy within its bounded lifetime", async () => {
  const f = await fixture();
  io.decide.mockRejectedValue(new Error("policy_timeout: test deadline"));
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.reason).toBe("policy_unresponsive");
  expect(record.counters).toMatchObject({ steps: 3, missed: 3 });
  expect(f.events.filter((event) => event === "release")).toHaveLength(5);
});

it("retries an uncertain effect once with its identical lease envelope", async () => {
  const f = await fixture();
  const control = f.session.control;
  let uncertain = true;
  const actionRequests: unknown[] = [];
  f.session.control = vi.fn<GameRunSession["control"]>(async (request) => {
    if (request.operation.kind === "action") {
      actionRequests.push(structuredClone(request));
      if (uncertain) {
        uncertain = false;
        return { status: "unconfirmed", reason: "host_ack_unavailable" };
      }
      const result = await control(request);
      return result.status === "applied"
        ? { ...result, replayed: true }
        : result;
    }
    return control(request);
  });
  io.decide.mockResolvedValue({
    control: { kind: "action", actionId: "tap" },
  });
  passAfterEffect("Recovered receipt.");
  await f.owner.start(f.request);
  expect((await f.ended()).end?.reason).toBe("completed");
  expect(actionRequests).toHaveLength(2);
  expect(actionRequests[1]).toEqual(actionRequests[0]);
  const trace = await readFile(
    path.join(
      f.root,
      ".airjam/artifacts/runs",
      f.request.runId,
      "trace.ndjson",
    ),
    "utf8",
  );
  expect(trace).toContain('"kind":"control_attempt"');
});

it("delivers each effect receipt once even when its decision times out, then delivers the safety release", async () => {
  const f = await fixture();
  io.decide
    .mockResolvedValueOnce({ control: { kind: "action", actionId: "tap" } })
    .mockRejectedValueOnce(new Error("policy_timeout: delayed policy"))
    .mockResolvedValueOnce({
      control: { kind: "release" },
    });
  await f.owner.start(f.request);
  await vi.waitFor(() =>
    expect(io.decide.mock.calls.length).toBeGreaterThanOrEqual(3),
  );
  await f.owner.stop(f.request.runId);
  const second = io.decide.mock.calls[1][0];
  const third = io.decide.mock.calls[2][0];
  expect(second.receipts).toMatchObject([
    { operation: { kind: "action", actionId: "tap" } },
  ]);
  expect(third.receipts).toMatchObject([{ operation: { kind: "release" } }]);
});

it("ends repeated stale decisions with a latency reason and releases held input", async () => {
  const f = await fixture();
  const control = f.session.control;
  f.session.control = vi.fn<GameRunSession["control"]>((request) =>
    request.operation.kind === "input"
      ? Promise.resolve({ status: "rejected", reason: "stale_decision" })
      : control(request),
  );
  io.decide.mockResolvedValue({
    control: { kind: "input", input: { direction: 1 } },
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.reason).toBe("decision_latency");
  expect(record.counters.missed).toBe(3);
});

it("forces only the run's local runtime after normal cleanup throws and preserves the uncertainty", async () => {
  const f = await fixture();
  const close = f.session.close;
  f.session.close = vi.fn().mockRejectedValue(new Error("normal close failed"));
  f.session.forceClose = vi.fn(close);
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalled());
  const record = await f.owner.stop(f.request.runId);
  expect(record.cleanup).toMatchObject({
    forced: true,
    close: { closed: true },
    errors: ["normal close failed"],
  });
  expect(f.session.forceClose).toHaveBeenCalledOnce();
  expect(f.sessionClosed).toHaveBeenCalledOnce();
});

it("keeps recent ended records bounded without limiting later runs or losing admission idempotency", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({
    control: { kind: "action", actionId: "tap" },
  });
  passAfterEffect("Finished.");
  for (let index = 0; index < 34; index++) {
    const runId = index === 0 ? f.request.runId : randomUUID();
    await f.owner.start({ ...f.request, runId });
    await vi.waitFor(
      async () => expect((await f.owner.read(runId)).state).toBe("ended"),
      { interval: 5 },
    );
  }
  expect(f.owner.list()).toHaveLength(32);
  expect((await f.owner.start(f.request)).end?.reason).toBe("completed");
  expect(f.openSession).toHaveBeenCalledTimes(34);
});

it("reports a previous owner's unfinished run as lost without rewriting its last receipt", async () => {
  const f = await fixture();
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalled());
  const record = await f.owner.stop(f.request.runId);
  const retained = {
    ...record,
    state: "playing",
    end: undefined,
    endedAt: undefined,
  };
  const file = path.join(
    f.root,
    ".airjam/artifacts/runs",
    f.request.runId,
    "record.json",
  );
  const source = JSON.stringify(retained);
  await writeFile(file, source);
  const other = new GameRunOwner({
    projectDir: f.root,
    ownerInstanceId: randomUUID(),
    openSession: f.openSession,
    sessionClosed: f.sessionClosed,
  });
  expect(await other.read(f.request.runId)).toMatchObject({
    state: "ended",
    end: { reason: "owner_lost", outcome: "inconclusive" },
  });
  expect(await readFile(file, "utf8")).toBe(source);
  await other.drain();
});

it("never accepts a scenario pass before every seat produces an actual play effect", async () => {
  const f = await fixture();
  io.evaluate.mockResolvedValue({
    status: "passed",
    message: "Premature result.",
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end).toMatchObject({
    reason: "untested_seat",
    outcome: "inconclusive",
  });
  expect(io.decide).not.toHaveBeenCalled();
  expect(record.evaluation?.final?.status).toBe("passed");
});

it("a final settled failure overrides a play pass", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({ control: { kind: "action", actionId: "tap" } });
  let played = false;
  io.evaluate.mockImplementation(async (sample) => {
    if (sample.phase === "final")
      return {
        status: "failed",
        message: "An extra score arrived after release.",
      };
    played ||= sample.receipts.some(
      (receipt: { phase: string; operation: { kind: string } }) =>
        receipt.phase === "play" && receipt.operation.kind === "action",
    );
    return { status: played ? "passed" : "pending" };
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.evaluation).toMatchObject({
    play: { status: "passed" },
    final: { status: "failed" },
  });
  expect(record.end).toMatchObject({
    reason: "failed",
    outcome: "failed",
    message: "An extra score arrived after release.",
  });
});

it("Stop kills the actor before release while the independent evaluator still judges the final sample", async () => {
  const f = await fixture();
  io.decide.mockImplementation(() => new Promise(() => {}));
  io.stopPolicy.mockImplementation(async () => {
    f.events.push("actor-stopped");
  });
  io.stopEvaluator.mockImplementation(async () => {
    f.events.push("judge-stopped");
  });
  io.evaluate.mockImplementation(async (sample) => {
    if (sample.phase === "final") f.events.push("final-judged");
    return { status: "passed" };
  });
  // Reach the stalled decision before allowing the evaluator's terminal verdict.
  io.evaluate.mockResolvedValueOnce({ status: "pending" });
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalledOnce());
  const record = await f.owner.stop(f.request.runId);
  expect(record.end).toMatchObject({
    reason: "stopped",
    outcome: "inconclusive",
  });
  expect(f.events.indexOf("actor-stopped")).toBeLessThan(
    f.events.lastIndexOf("release"),
  );
  expect(f.events.indexOf("final-judged")).toBeGreaterThan(
    f.events.indexOf("actor-stopped"),
  );
  expect(f.events.indexOf("judge-stopped")).toBeLessThan(
    f.events.indexOf("close"),
  );
});

it("binds two actual players to one owned session and leaves extras before closing the host", async () => {
  const f = await twoSeatFixture();
  const extra = f.extra;
  io.decide.mockResolvedValue({ control: { kind: "action", actionId: "tap" } });
  const effects = new Set<string>();
  io.evaluate.mockImplementation(async (sample) => {
    for (const receipt of sample.receipts)
      if (receipt.phase === "play" && receipt.operation.kind === "action")
        effects.add(receipt.seatId);
    return { status: effects.size === 2 ? "passed" : "pending" };
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.outcome).toBe("passed");
  expect(f.openSession).toHaveBeenCalledOnce();
  expect(f.openSession).toHaveBeenCalledWith({
    runId: f.request.runId,
    gameId: undefined,
    nickname: "Agent 1",
    attachment: undefined,
    build: expect.objectContaining({ rootDir: "/sealed" }),
    onScope: expect.any(Function),
  });
  expect(f.session.addParticipant).toHaveBeenCalledWith("Agent 2");
  expect(
    record.seats.map((seat) => [
      seat.seatId,
      seat.controllerId,
      seat.counters.effects,
    ]),
  ).toEqual([
    ["left", "player", 1],
    ["right", "second", 1],
  ]);
  const left = vi
    .mocked(f.session.control)
    .mock.calls.filter(
      ([request]) => request.operation.kind === "action",
    )[0][0];
  const right = extra.control.mock.calls.find(
    ([request]) => request.operation.kind === "action",
  )?.[0];
  expect(right?.lease.id).not.toBe(left.lease.id);
  expect(extra.close).toHaveBeenCalledOnce();
  expect(f.events.indexOf("extra-left")).toBeLessThan(
    f.events.indexOf("close"),
  );
  expect(record.cleanup?.seats).toMatchObject([
    { seatId: "left", release: { status: "applied" } },
    {
      seatId: "right",
      release: { status: "applied" },
      disconnection: { leave: { status: "acknowledged" } },
    },
  ]);
});

it("classifies the SDK's capture-time identity rejection as runtime replacement", async () => {
  const f = await fixture();
  const observe = f.session.observe;
  let samples = 0;
  f.session.observe = vi.fn(async (options) => {
    if (++samples > 1)
      throw new Error(
        "observation_replaced: The requested game observation changed.",
      );
    return observe(options);
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end).toMatchObject({
    reason: "runtime_replaced",
    outcome: "inconclusive",
  });
  expect(record.evidence?.error).toContain("observation_replaced");
  expect(io.decide).not.toHaveBeenCalled();
});

it("refuses later admission when an extra participant cannot be disposed", async () => {
  const f = await twoSeatFixture();
  f.extra.close.mockRejectedValue(new Error("Socket close failed"));
  f.extra.forceClose.mockRejectedValue(new Error("Forced socket close failed"));
  const tracked = fixtures.find((value) => value.owner === f.owner);
  if (!tracked) throw new Error("Missing fixture cleanup ownership.");
  tracked.unconfirmed = true;
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalled());
  const record = await f.owner.stop(f.request.runId);
  expect(record.cleanup?.participantsClosed).toBe(false);
  await expect(
    f.owner.start({ ...f.request, runId: randomUUID() }),
  ).rejects.toThrow("run_busy");
  expect(f.sessionClosed).not.toHaveBeenCalled();
});

it("does not retain a success reason when the runtime changes during final evidence", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({ control: { kind: "action", actionId: "tap" } });
  passAfterEffect("Tentative pass.");
  const observe = f.session.observe;
  f.session.observe = vi.fn(async (options) => {
    if (options.includeImage)
      throw new Error(
        "observation_replaced: Host reloaded during final capture.",
      );
    return observe(options);
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end).toMatchObject({
    reason: "runtime_replaced",
    outcome: "inconclusive",
  });
  expect(record.evidence?.observation).toBeNull();
});

it("checks every seat around judging so a disconnected extra cannot become a scoring failure", async () => {
  const f = await twoSeatFixture();
  f.extra.checkConnected.mockRejectedValue(
    new Error("seat_replaced: Extra player disconnected."),
  );
  io.evaluate.mockResolvedValue({
    status: "failed",
    message: "Absent player's state",
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end).toMatchObject({
    reason: "seat_replaced",
    outcome: "inconclusive",
  });
  expect(io.evaluate).not.toHaveBeenCalled();
  expect(record.evaluation).toBeUndefined();
});

it("retains setup failure without letting an uninitialized scenario judge it as gameplay", async () => {
  const f = await fixture();
  const control = f.session.control;
  f.session.control = vi.fn(async (request) =>
    request.operation.kind === "release" && request.lease.sequence === 1
      ? ({ status: "rejected", reason: "stale_decision" } as const)
      : control(request),
  );
  io.evaluate.mockResolvedValue({
    status: "failed",
    message: "Missing baseline",
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end).toMatchObject({
    reason: "error",
    outcome: "inconclusive",
    message: expect.stringContaining("handshake"),
  });
  expect(io.evaluate).not.toHaveBeenCalled();
  expect(record.evaluation).toBeUndefined();
});

it("keeps a tentative pass inconclusive while final judgement is pending", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({ control: { kind: "action", actionId: "tap" } });
  let tested = false;
  let finishFinal: (verdict: { status: "passed" }) => void = () => {
    throw new Error("Final judge not waiting");
  };
  io.evaluate.mockImplementation(async (sample) => {
    if (sample.phase === "final")
      return new Promise((resolve) => {
        finishFinal = resolve;
      });
    tested ||= sample.receipts.some(
      (receipt: { phase: string; operation: { kind: string } }) =>
        receipt.phase === "play" && receipt.operation.kind === "action",
    );
    return { status: tested ? "passed" : "pending" };
  });
  await f.owner.start(f.request);
  await vi.waitFor(() =>
    expect(
      io.evaluate.mock.calls.some(([sample]) => sample.phase === "final"),
    ).toBe(true),
  );
  expect((await f.owner.read(f.request.runId)).end?.outcome).toBe(
    "inconclusive",
  );
  expect(f.owner.list()[0].end?.outcome).toBe("inconclusive");
  finishFinal({ status: "passed" });
  expect((await f.ended()).end?.outcome).toBe("passed");
});

it("requires acknowledged cleanup releases before a completed scenario can pass", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({ control: { kind: "action", actionId: "tap" } });
  passAfterEffect("Tentative pass");
  const control = f.session.control;
  f.session.control = vi.fn(async (request) =>
    request.operation.kind === "release" && request.lease.sequence > 1
      ? ({ status: "unconfirmed", reason: "host_ack_unavailable" } as const)
      : control(request),
  );
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.evaluation?.final?.status).toBe("passed");
  expect(record.end).toMatchObject({
    outcome: "inconclusive",
    message: expect.stringContaining("input release"),
  });
  expect(record.cleanup?.seats[0].release?.status).toBe("unconfirmed");
});

it("waits for actual room membership and retains it before any scenario actions", async () => {
  const f = await twoSeatFixture();
  f.session.readParticipants = vi
    .fn()
    .mockResolvedValueOnce({ roomId: "ROOM", controllerIds: ["player"] })
    .mockResolvedValue({ roomId: "ROOM", controllerIds: ["player", "second"] });
  io.decide.mockResolvedValue({ control: { kind: "action", actionId: "tap" } });
  const played = new Set<string>();
  io.evaluate.mockImplementation(async (sample) => {
    for (const receipt of sample.receipts)
      if (receipt.phase === "play" && receipt.operation.kind === "action")
        played.add(receipt.seatId);
    return { status: played.size === 2 ? "passed" : "pending" };
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.outcome).toBe("passed");
  expect(f.session.readParticipants).toHaveBeenCalledTimes(2);
  const events = (
    await readFile(
      path.join(
        f.root,
        ".airjam/artifacts/runs",
        f.request.runId,
        "trace.ndjson",
      ),
      "utf8",
    )
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const ready = events.find((event) => event.kind === "participants_ready");
  expect(ready).toMatchObject({
    gameSessionId: f.session.summary.gameSessionId,
    roomId: "ROOM",
    controllerIds: ["player", "second"],
    expected: record.expected,
  });
  expect(events.indexOf(ready)).toBeLessThan(
    events.findIndex(
      (event) => event.kind === "control" && event.phase === "play",
    ),
  );
});

it("refuses an unexpected participant in a fresh owned test room", async () => {
  const f = await twoSeatFixture();
  f.session.readParticipants = vi.fn(async () => ({
    roomId: "ROOM",
    controllerIds: ["player", "second", "uncontrolled"],
  }));
  await f.owner.start(f.request);
  expect((await f.ended()).end).toMatchObject({
    reason: "seat_replaced",
    outcome: "inconclusive",
  });
  expect(io.decide).not.toHaveBeenCalled();
  expect(io.evaluate).not.toHaveBeenCalled();
});

it("bounds a result wait and disconnects a waiter without stopping play", async () => {
  const f = await fixture();
  await f.owner.start(f.request);
  expect((await f.owner.wait(f.request.runId, 1)).state).not.toBe("ended");
  const cancellation = new AbortController();
  const waiting = f.owner.wait(f.request.runId, 30_000, cancellation.signal);
  cancellation.abort();
  await expect(waiting).rejects.toThrow();
  expect((await f.owner.read(f.request.runId)).state).not.toBe("ended");
  expect(f.session.close).not.toHaveBeenCalled();
});

it("stops every active project run before allowing another admission", async () => {
  const f = await fixture();
  await f.owner.start(f.request);
  const records = await f.owner.stopAll();
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    state: "ended",
    cleanup: { participantsClosed: true },
  });
  expect(await f.owner.stopAll()).toEqual([]);
  await expect(
    f.owner.start({ ...f.request, runId: randomUUID() }),
  ).resolves.toMatchObject({ state: "starting" });
});

it("fences an unknown admission so a delayed start cannot create a player", async () => {
  const f = await fixture();
  expect(await f.owner.cancel(f.request.runId)).toMatchObject({
    runId: f.request.runId,
    fenced: true,
    record: null,
  });
  await expect(f.owner.start(f.request)).rejects.toThrow("run_cancelled");
  expect(f.openSession).not.toHaveBeenCalled();
  expect((await f.owner.cancel(f.request.runId)).record).toBeNull();
});

it("cancels a known in-flight admission through the same terminal cleanup", async () => {
  const f = await fixture();
  let completeOpen = (_session: GameRunSession) => {};
  const opening = new Promise<GameRunSession>((resolve) => {
    completeOpen = resolve;
  });
  f.openSession.mockReturnValue(opening);
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(f.openSession).toHaveBeenCalledOnce());
  const cancellation = f.owner.cancel(f.request.runId);
  completeOpen(f.session);
  const result = await cancellation;
  expect(result).toMatchObject({
    fenced: true,
    record: { state: "ended", cleanup: { participantsClosed: true } },
  });
  expect(io.decide).not.toHaveBeenCalled();
});

it("bounds trace bytes, records truncation, and still releases and closes every seat", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({
    control: {
      kind: "action",
      actionId: "tap",
      input: { payload: "x".repeat(15_000) },
    },
  });
  await f.owner.start({
    ...f.request,
    budget: { durationMs: 40_000, steps: 5000 },
  });
  const record = await f.owner.wait(f.request.runId, 30_000);
  expect(record.end).toMatchObject({
    reason: "trace_budget",
    outcome: "inconclusive",
  });
  expect(record.cleanup?.participantsClosed).toBe(true);
  expect(record.evidence?.trace).toMatchObject({ truncated: true });
  const trace = await readFile(
    path.join(
      f.root,
      ".airjam/artifacts/runs",
      f.request.runId,
      "trace.ndjson",
    ),
  );
  expect(trace.byteLength).toBeLessThanOrEqual(MAXIMUM_GAME_RUN_TRACE_BYTES);
  expect(record.evidence?.trace?.bytes).toBe(trace.byteLength);
  expect(f.session.close).toHaveBeenCalledOnce();
}, 40_000);

it("finishes participant cleanup even when the trace file becomes unwritable", async () => {
  const f = await fixture();
  io.decide.mockImplementation(() => new Promise(() => {}));
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalled());
  const filename = path.join(
    f.root,
    ".airjam/artifacts/runs",
    f.request.runId,
    "trace.ndjson",
  );
  await rm(filename);
  await mkdir(filename);
  const record = await f.owner.stop(f.request.runId);
  expect(record.cleanup?.participantsClosed).toBe(true);
  expect(record.cleanup?.errors.length).toBeGreaterThan(0);
  expect(record.end?.outcome).toBe("inconclusive");
  expect(f.session.close).toHaveBeenCalledOnce();
});

it("wakes all waiters only after final evidence and cleanup settle", async () => {
  const f = await fixture();
  await f.owner.start(f.request);
  const waiting = [
    f.owner.wait(f.request.runId, 30_000),
    f.owner.wait(f.request.runId, 30_000),
  ];
  await f.owner.stop(f.request.runId);
  for (const record of await Promise.all(waiting)) {
    expect(record.state).toBe("ended");
    expect(record.cleanup?.participantsClosed).toBe(true);
    expect(record.end?.reason).toBe("stopped");
  }
  expect(await readTerminalGameRun(f.root, f.request.runId)).toEqual(
    await f.owner.read(f.request.runId),
  );
});

it("accepts only a complete correctly addressed terminal record offline", async () => {
  const f = await fixture();
  await f.owner.start(f.request);
  expect(await readTerminalGameRun(f.root, f.request.runId)).toBeNull();
  const record = await f.owner.stop(f.request.runId);
  const filename = path.join(
    f.root,
    ".airjam",
    "artifacts",
    "runs",
    f.request.runId,
    "record.json",
  );
  await writeFile(filename, JSON.stringify({ ...record, runId: randomUUID() }));
  await expect(readTerminalGameRun(f.root, f.request.runId)).rejects.toThrow(
    "identity differs",
  );
  await writeFile(filename, JSON.stringify({ ...record, endedAt: undefined }));
  await expect(readTerminalGameRun(f.root, f.request.runId)).rejects.toThrow(
    "incomplete",
  );
  await rm(filename);
  const other = path.join(f.root, "other.json");
  await writeFile(other, JSON.stringify(record));
  await symlink(other, filename);
  await expect(readTerminalGameRun(f.root, f.request.runId)).rejects.toThrow();
  await expect(readTerminalGameRun(f.root, "../outside")).rejects.toThrow();
});

it("owned runs load both policy and evaluator from the same pinned source", async () => {
  const f = await fixture();
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalled());
  expect(io.build).toHaveBeenCalledWith(
    expect.objectContaining({
      projectDir: "/game",
      configRelative: "src/airjam.config.ts",
    }),
  );
  for (const [input] of io.startPolicy.mock.calls)
    expect(input).toMatchObject({
      rootDir: "/sealed",
      configPath: "/sealed/src/airjam.config.ts",
    });
  const result = await f.owner.stop(f.request.runId);
  expect(result.build?.integrity).toBe("verified");
  expect(io.verifyBuild).toHaveBeenCalledOnce();
});

it("cancelling a build cannot admit a browser or policy afterwards", async () => {
  const f = await fixture();
  io.build.mockImplementation(
    ({ signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      ),
  );
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(io.build).toHaveBeenCalled());
  const result = await f.owner.stop(f.request.runId);
  expect(result.state).toBe("ended");
  expect(result.end?.outcome).toBe("inconclusive");
  expect(f.openSession).not.toHaveBeenCalled();
  expect(io.startPolicy).not.toHaveBeenCalled();
});

it("a modified pinned tree cannot retain a formal pass", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({ control: { kind: "action", actionId: "tap" } });
  io.evaluate.mockResolvedValue({ status: "passed" });
  io.verifyBuild.mockRejectedValueOnce(
    new Error("build_integrity_changed: source changed"),
  );
  await f.owner.start(f.request);
  const result = await f.ended();
  expect(result.end).toMatchObject({
    reason: "runtime_replaced",
    outcome: "inconclusive",
  });
  expect(result.build?.integrity).toBe("changed");
  expect(result.cleanup?.close?.closed).toBe(true);
});

function expectUnconfirmedFixture(owner: GameRunOwner) {
  const tracked = fixtures.find((value) => value.owner === owner);
  if (!tracked) throw new Error("Missing fixture cleanup ownership.");
  tracked.unconfirmed = true;
}

it("a compiler failure with confirmed process cleanup releases later run admission", async () => {
  const f = await fixture();
  io.build.mockImplementationOnce(async (options) => {
    options.onScope(async () => {});
    throw new Error("compiler failed");
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.message).toContain("compiler failed");
  expect(record.cleanup?.processesClosed).toBe(true);
  await expect(
    f.owner.start({ ...f.request, runId: randomUUID() }),
  ).resolves.toMatchObject({ state: "starting" });
});

it("an unconfirmed build scope blocks new admission and successful broker drain", async () => {
  const f = await fixture();
  expectUnconfirmedFixture(f.owner);
  io.build.mockImplementationOnce(async (options) => {
    options.onScope(async () => {
      throw new Error("process_tree_unconfirmed: build child");
    });
    throw new Error("compiler failed");
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.message).toContain("compiler failed");
  expect(record.cleanup?.processesClosed).toBe(false);
  expect(record.cleanup?.errors).toContain(
    "process_tree_unconfirmed: build child",
  );
  await expect(
    f.owner.start({ ...f.request, runId: randomUUID() }),
  ).rejects.toThrow("run_busy");
  await expect(f.owner.drain()).rejects.toThrow("run_cleanup_unconfirmed");
});

it("a closed host cannot hide an unconfirmed policy scope or retain a pass", async () => {
  const f = await fixture();
  expectUnconfirmedFixture(f.owner);
  io.startPolicy.mockImplementation(async (options) => {
    options.onScope(async () => {
      if (options.role === "policy")
        throw new Error("process_tree_unconfirmed: policy child");
    });
    return {
      profiles: [structuredClone(profile)],
      decide: io.decide,
      evaluate: io.evaluate,
      busy: () => false,
      stop: options.role === "policy" ? io.stopPolicy : io.stopEvaluator,
    };
  });
  io.decide.mockResolvedValue({ control: { kind: "action", actionId: "tap" } });
  io.evaluate.mockResolvedValue({ status: "passed" });
  io.stopPolicy.mockRejectedValueOnce(
    new Error("policy scope could not close"),
  );
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.cleanup?.close?.closed).toBe(true);
  expect(record.cleanup?.processesClosed).toBe(false);
  expect(record.end?.outcome).toBe("inconclusive");
});

it("tracks a policy scope even when startup fails before returning its handle", async () => {
  const f = await fixture();
  expectUnconfirmedFixture(f.owner);
  io.startPolicy.mockImplementationOnce(async (options) => {
    options.onScope(async () => {
      throw new Error("process_tree_unconfirmed: startup child");
    });
    throw new Error("policy initialization failed");
  });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.message).toContain("policy initialization failed");
  expect(record.cleanup?.processesClosed).toBe(false);
  expect(f.openSession).not.toHaveBeenCalled();
  await expect(f.owner.drain()).rejects.toThrow("run_cleanup_unconfirmed");
});

it("keeps a failed discovery scope liable to Stop and broker shutdown before another run exists", async () => {
  const f = await fixture();
  expectUnconfirmedFixture(f.owner);
  io.stopPolicy.mockImplementationOnce(async () => {
    const error = new Error("process_tree_unconfirmed: discovery scope");
    io.assertScopes.mockImplementation(() => {
      throw error;
    });
    throw error;
  });
  await expect(f.owner.discover()).rejects.toThrow("discovery scope");
  await expect(f.owner.start(f.request)).rejects.toThrow("discovery scope");
  expect(io.build).not.toHaveBeenCalled();
  await expect(f.owner.stopAll()).rejects.toThrow("discovery scope");
  await expect(f.owner.drain()).rejects.toThrow("discovery scope");
});
it("drain waits for an already admitted discovery and refuses any discovery after shutdown", async () => {
  const f = await fixture();
  const close = Promise.withResolvers<void>();
  io.stopPolicy.mockReturnValueOnce(close.promise);
  const discovery = f.owner.discover();
  await vi.waitFor(() => expect(io.stopPolicy).toHaveBeenCalledOnce());
  let drained = false;
  const draining = f.owner.drain().then(() => {
    drained = true;
  });
  await Promise.resolve();
  expect(drained).toBe(false);
  await expect(f.owner.discover()).rejects.toThrow("owner_stopping");
  close.resolve();
  await discovery;
  await draining;
  expect(drained).toBe(true);
});
it("a run waits for prior discovery and cannot outlive its unconfirmed scope", async () => {
  const f = await fixture();
  expectUnconfirmedFixture(f.owner);
  const close = Promise.withResolvers<void>();
  io.stopPolicy.mockReturnValueOnce(close.promise);
  const discovery = f.owner.discover();
  const rejectedDiscovery =
    expect(discovery).rejects.toThrow("discovery scope");
  await vi.waitFor(() => expect(io.stopPolicy).toHaveBeenCalledOnce());
  const start = f.owner.start(f.request);
  const rejectedStart = expect(start).rejects.toThrow("discovery scope");
  await Promise.resolve();
  expect(io.build).not.toHaveBeenCalled();
  const error = new Error("process_tree_unconfirmed: discovery scope");
  io.assertScopes.mockImplementation(() => {
    throw error;
  });
  close.reject(error);
  await rejectedDiscovery;
  await rejectedStart;
  expect(io.build).not.toHaveBeenCalled();
});
it("a fault outside the run cannot become an empty-scope clean receipt", async () => {
  const f = await fixture();
  expectUnconfirmedFixture(f.owner);
  await f.owner.start(f.request);
  io.assertScopes.mockImplementation(() => {
    throw new Error("process_scope_unavailable: guardian exited");
  });
  const record = await f.owner.stop(f.request.runId);
  expect(record.cleanup?.processesClosed).toBe(false);
  expect(record.cleanup?.errors).toContain(
    "process_scope_unavailable: guardian exited",
  );
  expect(record.end?.outcome).toBe("inconclusive");
});

it("watches only actual owned seats, records the perturbation and closes before its runtime", async () => {
  const f = await fixture();
  const events: unknown[] = [];
  const watch = vi.fn(
    async (
      onEvent: Parameters<GameRunSession["watch"]>[0],
      signal: AbortSignal,
    ) => {
      onEvent({ type: "ready", width: 320, height: 180 });
      await new Promise<void>((resolve) =>
        signal.addEventListener(
          "abort",
          () => {
            f.events.push("watch-closed");
            resolve();
          },
          { once: true },
        ),
      );
      onEvent({ type: "frame", seq: 100, capturedAt: 100, data: "late" });
    },
  );
  f.session.watch = watch;
  await f.owner.start(f.request);
  await vi.waitFor(async () =>
    expect((await f.owner.read(f.request.runId)).state).toBe("playing"),
  );
  const cancellation = new AbortController();
  const watching = f.owner.watch(
    {
      runId: f.request.runId,
      surface: { kind: "controller", seatId: "player" },
    },
    (event) => events.push(event),
    cancellation.signal,
  );
  await vi.waitFor(() => expect(watch).toHaveBeenCalledOnce());
  await expect(
    f.owner.watch(
      {
        runId: f.request.runId,
        surface: { kind: "controller", seatId: "player" },
      },
      () => {},
      cancellation.signal,
    ),
  ).rejects.toThrow("already has a producer");
  await expect(
    f.owner.watch(
      {
        runId: f.request.runId,
        surface: { kind: "controller", seatId: "intruder" },
      },
      () => {},
      cancellation.signal,
    ),
  ).rejects.toThrow("does not belong");
  const record = await f.owner.stop(f.request.runId);
  await watching;
  expect(events).toEqual([
    {
      type: "ready",
      runId: f.request.runId,
      surface: { kind: "controller", seatId: "player" },
      width: 320,
      height: 180,
    },
  ]);
  expect(f.events.indexOf("watch-closed")).toBeLessThan(
    f.events.indexOf("close"),
  );
  expect(record.cleanup?.processesClosed).toBe(true);
  const trace = await readFile(
    path.join(
      f.root,
      ".airjam/artifacts/runs",
      f.request.runId,
      "trace.ndjson",
    ),
    "utf8",
  );
  expect(trace).toContain('"kind":"watch_started"');
  expect(trace).toContain('"kind":"watch_stopped"');
  await expect(
    f.owner.watch(
      { runId: f.request.runId, surface: { kind: "host" } },
      () => {},
      cancellation.signal,
    ),
  ).rejects.toThrow("active owned");
});

it("a failed viewer does not change a passing gameplay verdict when process cleanup succeeds", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({ control: { kind: "action", actionId: "tap" } });
  f.session.watchHost = vi.fn(async () => {
    throw new Error("CDP viewer failed");
  });
  await f.owner.start(f.request);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalled());
  await expect(
    f.owner.watch(
      { runId: f.request.runId, surface: { kind: "host" } },
      () => {},
      new AbortController().signal,
    ),
  ).rejects.toThrow("CDP viewer failed");
  io.evaluate.mockResolvedValue({
    status: "passed",
    message: "Gameplay completed.",
  });
  const record = await f.ended();
  expect(record.end?.outcome).toBe("passed");
  expect(record.watched).toBe(true);
  expect(record.cleanup?.errors).toEqual([]);
  expect(
    await readFile(
      path.join(
        f.root,
        ".airjam/artifacts/runs",
        f.request.runId,
        "trace.ndjson",
      ),
      "utf8",
    ),
  ).toContain('"kind":"watch_failed"');
});

const tapOrWait = {
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

it("plays a decision model's choice as the option's own control and traces the answer", async () => {
  const decisions = vi.fn<DecisionProvider["ask"]>(async () => ({
    choice: "tap",
    confidence: 0.93,
  }));
  const f = await fixture({ decisions });
  io.decide.mockResolvedValue(tapOrWait);
  passAfterEffect("Tapped.");
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.reason).toBe("completed");
  expect(record.decisionModel).toBe("test-model");
  expect(decisions).toHaveBeenCalledWith(
    tapOrWait.ask,
    expect.any(AbortSignal),
  );
  expect(f.events).toContain("action");
  const trace = await readFile(
    path.join(
      f.root,
      ".airjam/artifacts/runs",
      f.request.runId,
      "trace.ndjson",
    ),
    "utf8",
  );
  expect(trace).toContain('"answer":{"choice":"tap","confidence":0.93');
  expect(JSON.stringify(vi.mocked(f.session.control).mock.calls)).not.toContain(
    "confidence",
  );
});

it("hands the seat's policy the model's latest answer on its next step", async () => {
  const f = await fixture({
    decisions: async () => ({ choice: "tap", confidence: 0.93 }),
  });
  io.decide.mockResolvedValue(tapOrWait);
  io.evaluate.mockImplementation(async () => ({
    status: io.decide.mock.calls.length >= 2 ? "passed" : "pending",
    message: "Asked twice.",
  }));
  await f.owner.start(f.request);
  await f.ended();
  expect(io.decide.mock.calls.map(([step]) => step.answer).slice(0, 2)).toEqual(
    [null, { choice: "tap", confidence: 0.93 }],
  );
});

it("ends a run whose model stops answering, even when the contract acts between questions", async () => {
  let answered = 0;
  const f = await fixture({
    decisions: async () => {
      if (answered++ === 0) return { choice: "tap", confidence: 0.9 };
      throw new Error("decision_failed: Decision model returned HTTP 500.");
    },
  });
  const decider = await createAirJamPlayerPolicy({
    brief: "A shared counter.",
    turn: () => tapOrWait.ask,
    act: {
      rethinkMs: 50,
      create: () => ({ control: () => ({ kind: "action", actionId: "tap" }) }),
    },
  }).create({ seatId: "player", random: Math.random });
  io.decide.mockImplementation((step) => decider.decide(step));
  io.evaluate.mockResolvedValue({ status: "pending" });
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.reason).toBe("policy_unresponsive");
  expect(record.end?.message).toContain("HTTP 500");
});

it("records how fast the host simulated during play", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({ control: { kind: "release" } });
  io.evaluate.mockImplementation(async () => ({
    status: io.decide.mock.calls.length >= 3 ? "passed" : "pending",
    message: "Played a while.",
  }));
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.hostPace).toEqual({
    framesPerSecond: 10,
    simulationSpeed: 0.25,
  });
});

it("fails a run that asks a decision model when none is configured", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue(tapOrWait);
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end).toMatchObject({
    reason: "error",
    outcome: "inconclusive",
    message: expect.stringContaining("decision_provider_unavailable"),
  });
  expect(f.events).not.toContain("action");
});

it("treats an undeclared choice as a missed decision, never a fallback", async () => {
  const f = await fixture({
    decisions: async () => ({ choice: "reset_counter", confidence: 1 }),
  });
  io.decide.mockResolvedValue(tapOrWait);
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.reason).toBe("policy_unresponsive");
  expect(record.counters).toMatchObject({ missed: 3 });
  expect(f.events).not.toContain("action");
});

it("bounds the decision model by the policy's own decision deadline", async () => {
  const f = await fixture({
    decisions: (_question, signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason)),
      ),
  });
  io.decide.mockResolvedValue(tapOrWait);
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.reason).toBe("policy_unresponsive");
  expect(record.seats[0]?.counters.timeout).toBe(3);
  expect(f.events).not.toContain("action");
});

it("counts a failing decision model as a missed decision", async () => {
  const f = await fixture({
    decisions: async () => {
      throw new Error("Decision model returned HTTP 503.");
    },
  });
  io.decide.mockResolvedValue(tapOrWait);
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.reason).toBe("policy_unresponsive");
  expect(record.counters).toMatchObject({ missed: 3 });
});

it("treats an inherited property name as an undeclared choice, not a crash", async () => {
  const f = await fixture({
    decisions: async () => ({ choice: "constructor", confidence: 1 }),
  });
  io.decide.mockResolvedValue(tapOrWait);
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.reason).toBe("policy_unresponsive");
  expect(record.end?.message).toContain("did not offer");
});

it("records the model it asked and why each decision was missed, even when none succeed", async () => {
  const f = await fixture({
    decisions: async () => {
      throw new Error("Decision model returned HTTP 401.");
    },
  });
  io.decide.mockResolvedValue(tapOrWait);
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.decisionModel).toBe("test-model");
  expect(record.end?.message).toContain("HTTP 401");
  const trace = await readFile(
    path.join(
      f.root,
      ".airjam/artifacts/runs",
      f.request.runId,
      "trace.ndjson",
    ),
    "utf8",
  );
  expect(trace).toContain('"kind":"decision_missed"');
  expect(trace).toContain("HTTP 401");
});

it("gives each seat its starting intent and lets a steer change only what it reads", async () => {
  const f = await fixture({
    decisions: async () => ({ choice: "tap", confidence: 0.4 }),
  });
  io.decide.mockResolvedValue(tapOrWait);
  f.request.intents = { player: "Play cautiously." };
  await f.owner.start(f.request);
  await vi.waitFor(() =>
    expect(io.decide).toHaveBeenCalledWith(
      expect.objectContaining({ intent: "Play cautiously." }),
      expect.any(Number),
    ),
  );
  const steered = await f.owner.steer({
    runId: f.request.runId,
    seatId: "player",
    intent: "Try to break the scoring.",
    source: "creator",
  });
  expect(steered.seats[0]?.intent).toBe("Try to break the scoring.");
  expect(steered.steering).toEqual([
    expect.objectContaining({
      seatId: "player",
      intent: "Try to break the scoring.",
      source: "creator",
    }),
  ]);
  await vi.waitFor(() =>
    expect(io.decide).toHaveBeenLastCalledWith(
      expect.objectContaining({ intent: "Try to break the scoring." }),
      expect.any(Number),
    ),
  );
  const record = await f.owner.stop(f.request.runId);
  const answers = record.seats[0]?.answers;
  expect(answers?.answered).toBeGreaterThanOrEqual(3);
  expect(answers?.choices.tap).toBe(answers?.answered);
  expect(answers?.lowConfidence).toBe(answers?.answered);
  expect(answers?.lowConfidenceStretches).toBe(1);
  expect(JSON.stringify(vi.mocked(f.session.control).mock.calls)).not.toContain(
    "break the scoring",
  );
  await expect(
    f.owner.steer({ runId: f.request.runId, seatId: "player", intent: null }),
  ).rejects.toThrow("run_not_active");
});

it("tells a caller steering before the seats exist to use starting intents", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({ control: { kind: "release" } });
  const started = await f.owner.start(f.request);
  expect(started.seats).toEqual([]);
  await expect(
    f.owner.steer({ runId: f.request.runId, seatId: "player", intent: "x" }),
  ).rejects.toThrow("Seats are not ready yet");
  await f.owner.stop(f.request.runId);
});

it("refuses intents and steering for seats the profile does not have", async () => {
  const f = await fixture();
  io.decide.mockResolvedValue({ control: { kind: "release" } });
  f.request.intents = { goalkeeper: "Defend." };
  await f.owner.start(f.request);
  const record = await f.ended();
  expect(record.end?.message).toContain("run_intent_invalid");
  const g = await fixture();
  io.decide.mockResolvedValue({ control: { kind: "release" } });
  await g.owner.start(g.request);
  await vi.waitFor(() => expect(io.decide).toHaveBeenCalled());
  await expect(
    g.owner.steer({
      runId: g.request.runId,
      seatId: "goalkeeper",
      intent: "x",
    }),
  ).rejects.toThrow("run_seat_unknown");
  await g.owner.stop(g.request.runId);
});
