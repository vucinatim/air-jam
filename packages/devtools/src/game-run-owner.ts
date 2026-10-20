import type {
  ControllerLeasedControl,
  ControllerLeasedControlAck,
} from "@air-jam/sdk/protocol";
import { PARTICIPANT_CONTROL_DEADLINE_MS } from "@air-jam/sdk/protocol";
import {
  sameHostRuntimeIdentity,
  type HostObservation,
} from "@air-jam/sdk/runtime-control";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { ControllerDisconnection } from "./controller-protocol.js";
import type { DecisionAnswer, DecisionProvider } from "./decision-provider.js";
import {
  gameBuildIdentitySchema,
  type PinnedGameBuild,
} from "./game-build-protocol.js";
import { sealGameBuild, verifyPinnedGameBuild } from "./game-build.js";
import {
  currentRoomAttachmentSchema,
  gameRunAddressSchema,
  gameRunRecordSchema,
  gameRunSessionIdentitySchema,
  gameRunSteerSchema,
  MAXIMUM_GAME_RUN_STEERING_CHANGES,
  MAXIMUM_GAME_RUN_TRACE_BYTES,
  startGameRunSchema,
  type AirJamGameRunCancellation,
  type AirJamGameRunRecord,
  type CurrentRoomAttachment,
  type GameRunSteerOptions,
  type StartGameRunOptions,
} from "./game-run-protocol.js";
import { readGameRunArtifact } from "./game-run-record.js";
import {
  gameRunWatchRequestSchema,
  type GameRunWatchEvent,
  type GameSurfaceWatcher,
} from "./game-run-watch.js";
import { listGames } from "./games.js";
import {
  assertProcessScopesConfirmed,
  type ProcessScopeObserver,
} from "./managed-process-scope.js";
import { verifyPolicyArtifacts } from "./policy-artifacts.js";
import { startTestProfileProcess } from "./test-profile-process.js";
import type {
  AirJamDecisionQuestion,
  AirJamPlayControl,
  AirJamRunReceipt,
  AirJamScenarioVerdict,
  AirJamTestProfileDescription,
} from "./testing.js";
import type {
  AirJamGameSessionSummary,
  CloseGameSessionResult,
} from "./types.js";

type HostObservationIdentity = HostObservation["identity"];
type AnsweredDecision = DecisionAnswer & {
  control: AirJamPlayControl;
  durationMs: number;
};

type EndReason = NonNullable<AirJamGameRunRecord["end"]>["reason"];
/** Answers below this confidence count as unsure; this many in a row is a stretch. */
const LOW_CONFIDENCE = 0.6;
const LOW_CONFIDENCE_STRETCH = 3;
function agentNickname(index: number) {
  return `Agent ${index + 1}`;
}
function failureReason(message: string): EndReason {
  return /trace_budget/.test(message)
    ? "trace_budget"
    : /runtime_replaced|observation_replaced|stale_identity/.test(message)
      ? "runtime_replaced"
      : /seat_replaced/.test(message)
        ? "seat_replaced"
        : "error";
}
export type { AirJamGameRunRecord } from "./game-run-protocol.js";

export type GameRunParticipant = {
  watch: GameSurfaceWatcher;
  controllerId: string;
  checkConnected: () => Promise<void>;
  observe: (options: {
    scope: "player" | "diagnostic";
    includeImage: boolean;
    expected?: HostObservationIdentity;
  }) => Promise<HostObservation>;
  control: (
    request: Pick<ControllerLeasedControl, "expected" | "lease" | "operation">,
  ) => Promise<ControllerLeasedControlAck>;
  close: () => Promise<ControllerDisconnection>;
  forceClose: () => Promise<ControllerDisconnection>;
};
export type GameRunSession = Omit<
  GameRunParticipant,
  "controllerId" | "close" | "forceClose"
> & {
  summary: AirJamGameSessionSummary;
  watchHost: GameSurfaceWatcher;
  readParticipants: () => Promise<{ roomId: string; controllerIds: string[] }>;
  addParticipant: (nickname: string) => Promise<GameRunParticipant>;
  invokeHost: (actionId: string, input: unknown) => Promise<unknown>;
  close: () => Promise<CloseGameSessionResult>;
  forceClose: () => Promise<CloseGameSessionResult>;
};
type RunSeat = {
  id: string;
  controllerId: string;
  participant: Pick<
    GameRunParticipant,
    "observe" | "control" | "checkConnected" | "watch"
  >;
  extra?: GameRunParticipant;
  expected?: HostObservationIdentity;
  leaseId: string;
  sequence: number;
  policyCursor: number;
  misses: number;
  staleDecisions: number;
  lowConfidenceStreak: number;
  /** The model's answer to this seat's latest question, for its policy. */
  lastAnswer: { choice: string; confidence: number } | null;
};
type Run = {
  record: AirJamGameRunRecord;
  /** The host's simulation pace when play began, to measure play against. */
  paceStart?: NonNullable<HostObservation["pace"]>;
  attachment?: CurrentRoomAttachment;
  directory: string;
  abort: AbortController;
  session?: GameRunSession;
  build?: PinnedGameBuild;
  scopes: Array<() => Promise<void>>;
  watches: Map<string, Promise<void>>;
  policy?: Awaited<ReturnType<typeof startTestProfileProcess>>;
  evaluator?: Awaited<ReturnType<typeof startTestProfileProcess>>;
  evaluation?: Promise<AirJamScenarioVerdict>;
  evaluationCursor: number;
  playEvaluationSent: boolean;
  receiptIndex: number;
  effects: Set<Promise<ControllerLeasedControlAck>>;
  seats: RunSeat[];
  receipts: AirJamRunReceipt[];
  startup?: Promise<void>;
  admission?: Promise<void>;
  persistence: Promise<void>;
  tracing: Promise<void>;
  traceBytes: number;
  traceTruncated: boolean;
  termination?: Promise<void>;
  finished: AbortController;
  closed?: CloseGameSessionResult;
  deadline: number;
  timer?: ReturnType<typeof setTimeout>;
};

export class GameRunOwner {
  private runs = new Map<string, Run>();
  private admissions = new Set<Promise<unknown>>();
  private draining = false;
  private stoppingAll: Promise<AirJamGameRunRecord[]> | undefined;
  private directory: string;
  constructor(
    private readonly options: {
      projectDir: string;
      ownerInstanceId: string;
      openSession: (options: {
        runId: string;
        gameId?: string;
        nickname: string;
        attachment?: CurrentRoomAttachment;
        build?: PinnedGameBuild;
        onScope: ProcessScopeObserver;
      }) => Promise<GameRunSession>;
      sessionClosed: (gameSessionId: string) => void;
      decisions?: DecisionProvider;
    },
  ) {
    this.directory = path.join(
      options.projectDir,
      ".airjam",
      "artifacts",
      "runs",
    );
  }

  private persist(run: Run) {
    const source = `${JSON.stringify(gameRunRecordSchema.parse(run.record), null, 2)}\n`;
    const pending = run.persistence.then(async () => {
      const temporary = path.join(run.directory, "record.pending.json");
      await open(temporary, "w", 0o600).then(async (file) => {
        try {
          await file.writeFile(source);
        } finally {
          await file.close();
        }
      });
      await rename(temporary, path.join(run.directory, "record.json"));
    });
    run.persistence = pending.catch(() => undefined);
    return pending;
  }
  private trace(run: Run, event: Record<string, unknown>, diagnostic = false) {
    const bytes = Buffer.from(
      `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`,
    );
    const writing = run.tracing.then(async () => {
      const limit = run.abort.signal.aborted
        ? MAXIMUM_GAME_RUN_TRACE_BYTES
        : MAXIMUM_GAME_RUN_TRACE_BYTES - 131_072;
      if (run.traceBytes + bytes.byteLength > limit) {
        if (diagnostic) return;
        run.traceTruncated = true;
        if (run.abort.signal.aborted) return;
        throw new Error("trace_budget: Run trace reached its byte allowance.");
      }
      const file = await open(
        path.join(run.directory, "trace.ndjson"),
        "a",
        0o600,
      );
      try {
        await file.writeFile(bytes);
        run.traceBytes += bytes.byteLength;
      } finally {
        await file.close();
      }
    });
    // The caller receives failures; the journal must still accept teardown events.
    run.tracing = writing.catch(() => undefined);
    return writing;
  }
  private copy(record: AirJamGameRunRecord): AirJamGameRunRecord {
    return structuredClone(record);
  }
  private quiescent(run: Run) {
    return (
      run.record.state === "ended" &&
      run.record.cleanup?.processesClosed === true &&
      (!run.session ||
        (run.record.cleanup.close?.closed &&
          run.record.cleanup.participantsClosed))
    );
  }
  private observeScopes(run: Run): ProcessScopeObserver {
    return (close) => {
      run.scopes.push(close);
      if (run.abort.signal.aborted)
        void close().catch((error) => console.error(error));
    };
  }
  private prune() {
    const ended = [...this.runs.values()].filter((run) => this.quiescent(run));
    for (const expired of ended.slice(0, Math.max(0, ended.length - 32)))
      this.runs.delete(expired.record.runId);
  }

  async discover(
    gameId?: string,
  ): Promise<{ gameId: string; profiles: AirJamTestProfileDescription[] }> {
    if (this.draining || this.stoppingAll)
      throw new Error("owner_stopping: Profile discovery admission is closed.");
    if ([...this.runs.values()].some((run) => !this.quiescent(run)))
      throw new Error(
        "run_busy: Wait for the current run to finish before inspecting profiles.",
      );
    assertProcessScopesConfirmed();
    const discovery = (async () => {
      const game = await this.game(gameId);
      await mkdir(this.directory, { recursive: true });
      const policy = await startTestProfileProcess({
        rootDir: game.rootDir,
        configPath: game.configPath,
        seed: 0,
        role: "discover",
        logPath: path.join(this.directory, "discovery.log"),
      });
      try {
        return { gameId: game.id, profiles: policy.profiles };
      } finally {
        await policy.stop();
      }
    })();
    this.admissions.add(discovery);
    try {
      return await discovery;
    } finally {
      this.admissions.delete(discovery);
    }
  }
  private async game(gameId?: string) {
    const games = await listGames({ cwd: this.options.projectDir });
    const game = gameId
      ? games.find((candidate) => candidate.id === gameId)
      : games.length === 1
        ? games[0]
        : undefined;
    if (!game?.configPath)
      throw new Error("Choose a game that publishes an Air Jam config.");
    return { ...game, configPath: game.configPath };
  }

  async start(
    input: StartGameRunOptions,
    attachment?: CurrentRoomAttachment,
  ): Promise<AirJamGameRunRecord> {
    if (this.draining || this.stoppingAll)
      throw new Error("owner_stopping: Run admission is closed.");
    const request = startGameRunSchema.parse({
      ...input,
      cwd: this.options.projectDir,
    });
    const existing = this.runs.get(request.runId);
    if (existing) {
      if (JSON.stringify(existing.record.request) !== JSON.stringify(request))
        throw new Error(
          "run_conflict: Run ID was admitted with a different request.",
        );
      await existing.admission;
      return this.copy(existing.record);
    }
    if (request.target.kind === "current" && !attachment)
      throw new Error(
        "current_attachment_required: Current-room play requires a delegated editor.",
      );
    if (request.target.kind === "owned" && attachment)
      throw new Error(
        "unexpected_attachment: Owned tests do not accept current-room access.",
      );
    const current = attachment
      ? currentRoomAttachmentSchema.parse(attachment)
      : undefined;
    if ([...this.runs.values()].some((run) => !this.quiescent(run)))
      throw new Error(
        "run_busy: This project already has an active or unclosed run.",
      );
    assertProcessScopesConfirmed();
    const priorAdmissions = [...this.admissions];
    const run: Run = {
      attachment: current,
      scopes: [],
      watches: new Map(),
      record: {
        version: 1,
        runId: request.runId,
        ownerInstanceId: this.options.ownerInstanceId,
        request,
        state: "starting",
        startedAt: new Date().toISOString(),
        seats: [],
        counters: {
          steps: 0,
          applied: 0,
          rejected: 0,
          unconfirmed: 0,
          missed: 0,
        },
      },
      directory: path.join(this.directory, request.runId),
      abort: new AbortController(),
      seats: [],
      evaluationCursor: 0,
      playEvaluationSent: false,
      receiptIndex: 0,
      effects: new Set(),
      receipts: [],
      deadline: performance.now() + request.budget.durationMs,
      persistence: Promise.resolve(),
      tracing: Promise.resolve(),
      traceBytes: 0,
      traceTruncated: false,
      finished: new AbortController(),
    };
    this.runs.set(request.runId, run);
    const admission = (async () => {
      await Promise.allSettled(priorAdmissions);
      assertProcessScopesConfirmed();
      await mkdir(this.directory, { recursive: true });
      try {
        await mkdir(run.directory, { mode: 0o700 });
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "EEXIST"
        )
          throw error;
        try {
          await readFile(path.join(run.directory, "cancelled.json"));
          throw new Error(
            "run_cancelled: This run ID was fenced before admission.",
          );
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !("code" in error) ||
            error.code !== "ENOENT"
          )
            throw error;
        }
        const retained = gameRunRecordSchema.parse(
          JSON.parse(
            await readFile(path.join(run.directory, "record.json"), "utf8"),
          ),
        );
        if (retained.ownerInstanceId !== this.options.ownerInstanceId)
          throw new Error(
            "run_id_reused: A previous owner admitted this run ID.",
          );
        if (JSON.stringify(retained.request) !== JSON.stringify(request))
          throw new Error(
            "run_conflict: Run ID was admitted with a different request.",
          );
        if (retained.state !== "ended")
          throw new Error(
            "run_receipt_invalid: Retained run has no live activity or terminal receipt.",
          );
        run.record = retained;
        return;
      }
      await this.persist(run);
    })();
    run.admission = admission;
    this.admissions.add(admission);
    try {
      await admission;
    } catch (error) {
      this.runs.delete(request.runId);
      throw error;
    } finally {
      this.admissions.delete(admission);
    }
    if (run.record.state === "ended") {
      this.prune();
      return this.copy(run.record);
    }
    if (run.abort.signal.aborted || this.draining) {
      await this.terminate(
        run,
        "owner_stopping",
        "Run admission stopped before startup.",
      );
      return this.copy(run.record);
    }
    run.timer = setTimeout(
      () => {
        void this.terminate(
          run,
          "budget",
          "Run reached its time budget.",
        ).catch((error) => console.error(error));
      },
      Math.max(0, run.deadline - performance.now()),
    );
    run.startup = this.initialize(run);
    void run.startup.then(
      () => {
        if (!run.abort.signal.aborted)
          void this.play(run).catch((error) => this.failed(run, error));
      },
      (error) => this.failed(run, error),
    );
    return this.copy(run.record);
  }

  async read(runId: string): Promise<AirJamGameRunRecord> {
    const run = this.runs.get(runId);
    if (run) {
      if (run.record.state === "ended") await run.termination;
      return this.copy(run.record);
    }
    const source = await readFile(
      path.join(this.directory, runId, "record.json"),
      "utf8",
    );
    const record = gameRunRecordSchema.parse(JSON.parse(source));
    if (
      record.ownerInstanceId !== this.options.ownerInstanceId &&
      record.state !== "ended"
    )
      return {
        ...record,
        state: "ended" as const,
        end: {
          reason: "owner_lost" as const,
          outcome: "inconclusive" as const,
          message:
            "The session owner was replaced. This run cannot resume and has no confirmed teardown.",
        },
      };
    return record;
  }
  list(): AirJamGameRunRecord[] {
    return [...this.runs.values()].map((run) => this.copy(run.record));
  }
  async wait(
    runId: string,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<AirJamGameRunRecord> {
    const run = this.runs.get(runId);
    if (!run || run.record.state === "ended") return this.read(runId);
    const cancellation = new AbortController();
    const combined = signal
      ? AbortSignal.any([signal, cancellation.signal])
      : cancellation.signal;
    let completed = () => {};
    const finished = new Promise<void>((resolve) => {
      completed = resolve;
      run.finished.signal.addEventListener("abort", completed, { once: true });
    });
    try {
      await Promise.race([
        finished,
        delay(timeoutMs, undefined, { signal: combined }),
      ]);
      return await this.read(runId);
    } finally {
      cancellation.abort();
      run.finished.signal.removeEventListener("abort", completed);
    }
  }
  async stop(
    runId: string,
    reason: EndReason = "stopped",
  ): Promise<AirJamGameRunRecord> {
    const run = this.runs.get(runId);
    if (!run) return this.read(runId);
    await this.terminate(
      run,
      reason,
      reason === "stopped" ? "Stopped by the caller." : reason,
    );
    return this.copy(run.record);
  }
  /**
   * Change what one seat is trying to do while its run is active. Steering only
   * changes the intent its policy reads; controls still come from the policy.
   * Each change is recorded with its time and source.
   */
  async steer(input: GameRunSteerOptions): Promise<AirJamGameRunRecord> {
    const { runId, seatId, intent, source } = gameRunSteerSchema.parse(input);
    const run = this.runs.get(runId);
    if (
      !run ||
      run.abort.signal.aborted ||
      run.record.state === "ended" ||
      run.record.state === "stopping"
    )
      throw new Error("run_not_active: Only an active test can be steered.");
    if (!run.record.seats.length)
      throw new Error(
        "run_not_active: Seats are not ready yet; give starting goals as intents.",
      );
    const seat = run.record.seats.find(
      (candidate) => candidate.seatId === seatId,
    );
    if (!seat)
      throw new Error(`run_seat_unknown: Run ${runId} has no seat ${seatId}.`);
    const steering = (run.record.steering ??= []);
    if (steering.length >= MAXIMUM_GAME_RUN_STEERING_CHANGES)
      throw new Error(
        `steering_limit: A run records at most ${MAXIMUM_GAME_RUN_STEERING_CHANGES} steering changes.`,
      );
    seat.intent = intent;
    steering.push({ at: new Date().toISOString(), seatId, intent, source });
    await this.trace(run, { kind: "steer", seatId, intent, source });
    await this.persist(run);
    return this.copy(run.record);
  }
  stopAll(): Promise<AirJamGameRunRecord[]> {
    return (this.stoppingAll ??= (async () => {
      await Promise.allSettled(this.admissions);
      const pending = [...this.runs.values()].filter(
        (run) => !this.quiescent(run),
      );
      const records = await Promise.all(
        pending.map((run) => this.stop(run.record.runId)),
      );
      assertProcessScopesConfirmed();
      return records;
    })().finally(() => {
      this.stoppingAll = undefined;
    }));
  }
  async cancel(runId: string): Promise<AirJamGameRunCancellation> {
    gameRunAddressSchema.parse({ runId });
    const result = (record: AirJamGameRunRecord | null) => ({
      runId,
      ownerInstanceId: this.options.ownerInstanceId,
      fenced: true as const,
      record,
    });
    if (this.runs.has(runId)) return result(await this.stop(runId));
    assertProcessScopesConfirmed();
    await mkdir(this.directory, { recursive: true });
    const directory = path.join(this.directory, runId);
    try {
      await mkdir(directory, { mode: 0o700 });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EEXIST"
      )
        throw error;
      if (this.runs.has(runId)) return result(await this.stop(runId));
      try {
        return result(await this.read(runId));
      } catch (readError) {
        if (
          !(readError instanceof Error) ||
          !("code" in readError) ||
          readError.code !== "ENOENT"
        )
          throw readError;
      }
    }
    const marker = await open(
      path.join(directory, "cancelled.json"),
      "wx",
      0o600,
    ).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "EEXIST") return null;
      throw error;
    });
    if (marker) {
      try {
        await marker.writeFile(
          JSON.stringify({ runId, cancelledAt: new Date().toISOString() }),
        );
      } finally {
        await marker.close();
      }
    }
    return result(null);
  }
  async closeSession(runId: string, reason: EndReason) {
    const run = this.runs.get(runId);
    if (!run)
      throw new Error(
        "run_session_unavailable: No live activity owns this session.",
      );
    await this.terminate(run, reason, reason);
    if (!this.quiescent(run) || !run.closed?.closed)
      throw new Error(
        "run_cleanup_unconfirmed: Local runtime teardown was not confirmed.",
      );
    return run.closed;
  }
  async drain() {
    this.draining = true;
    await Promise.allSettled(this.admissions);
    const results = await Promise.allSettled(
      [...this.runs.values()].map((run) =>
        this.terminate(run, "owner_stopping", "Session owner is stopping."),
      ),
    );
    const failures = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failures.length)
      throw new AggregateError(failures, "Run cleanup failed.");
    if ([...this.runs.values()].some((run) => !this.quiescent(run)))
      throw new Error(
        "run_cleanup_unconfirmed: An owned process scope did not close.",
      );
    assertProcessScopesConfirmed();
  }

  private async initialize(run: Run) {
    const game = await this.game(run.record.request.gameId);
    if (run.abort.signal.aborted) return;
    if (run.record.request.target.kind === "owned") {
      run.build = await sealGameBuild({
        projectDir: game.rootDir,
        configRelative: path.relative(game.rootDir, game.configPath),
        runDirectory: run.directory,
        signal: run.abort.signal,
        onScope: this.observeScopes(run),
        onBuildLog: (receipt) => {
          run.record.evidence ??= { observation: null, error: null };
          run.record.evidence.buildLog = {
            ...receipt,
            path: `.airjam/artifacts/runs/${run.record.runId}/build.log`,
          };
        },
      });
      run.record.build = {
        ...gameBuildIdentitySchema.parse(run.build.manifest),
        integrity: "sealed",
      };
      await this.trace(run, {
        kind: "build_sealed",
        build: run.record.build,
        reused: run.build.reused,
      });
      await this.persist(run);
    }
    if (run.abort.signal.aborted) return;
    const common = {
      rootDir: run.build?.rootDir ?? game.rootDir,
      ...(run.build ? { toolingRootDir: run.build.rootDir } : {}),
      configPath: run.build?.configPath ?? game.configPath,
      profileId: run.record.request.profileId,
      seed: run.record.request.seed,
      onScope: this.observeScopes(run),
      startupSignal: run.abort.signal,
    };
    run.evaluator = await startTestProfileProcess({
      ...common,
      role: "evaluator",
      logPath: path.join(run.directory, "evaluator.log"),
    });
    if (run.abort.signal.aborted) return;
    const profile = run.evaluator.profiles.find(
      (candidate) => candidate.id === run.record.request.profileId,
    );
    if (!profile) throw new Error("Unknown test profile.");
    if (
      run.attachment &&
      profile.seats.length > run.attachment.controllerIds.length
    )
      throw new Error(
        `current_profile_invalid: Profile ${profile.id} needs ${profile.seats.length} seats; the creator's room issued ${run.attachment.controllerIds.length}.`,
      );
    const unknownIntent = Object.keys(run.record.request.intents ?? {}).find(
      (seatId) => !profile.seats.some((seat) => seat.id === seatId),
    );
    if (unknownIntent)
      throw new Error(
        `run_intent_invalid: Profile ${profile.id} has no seat ${unknownIntent}.`,
      );
    run.record.profile = profile;
    const policy = profile.policies.find(
      (candidate) => candidate.id === run.record.request.policyId,
    );
    if (!policy) throw new Error("Unknown test policy.");
    const artifacts =
      policy.artifacts === undefined
        ? undefined
        : await verifyPolicyArtifacts({
            projectDir: common.rootDir,
            manifestPath: path.join(common.rootDir, policy.artifacts),
            artifactRootDir: process.env.AIRJAM_TEST_ARTIFACTS_DIR,
            signal: run.abort.signal,
          });
    run.record.policyArtifacts = artifacts?.receipt;
    const initializing = performance.now();
    run.policy = await startTestProfileProcess({
      ...common,
      role: "policy",
      initializationDeadline: run.deadline,
      ...(artifacts ? { artifacts } : {}),
      policyId: run.record.request.policyId,
      logPath: path.join(run.directory, "policy.log"),
    });
    if (run.abort.signal.aborted) return;
    run.record.policyInitializationMs = performance.now() - initializing;
    run.record.policyPreparation = run.policy.preparation;
    await this.trace(run, {
      kind: "policy_prepared",
      initializationMs: run.record.policyInitializationMs,
      preparation: run.policy.preparation,
      ...(artifacts ? { artifacts: artifacts.receipt } : {}),
    });
    if (run.abort.signal.aborted) return;
    run.session = await this.options.openSession({
      runId: run.record.runId,
      gameId: run.record.request.gameId,
      nickname: agentNickname(0),
      attachment: run.attachment,
      build: run.build,
      onScope: this.observeScopes(run),
    });
    run.record.session = gameRunSessionIdentitySchema.parse(
      run.session.summary,
    );
    if (
      run.attachment &&
      (run.session.summary.controllerId !== run.attachment.controllerIds[0] ||
        run.session.summary.semanticAccess !== "delegated-host" ||
        run.session.summary.roomId !==
          new URL(run.attachment.controllerJoinUrl).searchParams.get("room"))
    )
      throw new Error(
        "current_room_scope: The delegated participant did not attach to its authorized room.",
      );
    for (const [index, description] of profile.seats.entries()) {
      if (index > 0 && run.abort.signal.aborted) return;
      const extra =
        index === 0
          ? undefined
          : await run.session.addParticipant(agentNickname(index));
      const controllerId =
        extra?.controllerId ?? run.session.summary.controllerId;
      run.seats.push({
        id: description.id,
        controllerId,
        participant: extra ?? run.session,
        extra,
        leaseId: randomUUID(),
        sequence: 0,
        policyCursor: 0,
        misses: 0,
        staleDecisions: 0,
        lowConfidenceStreak: 0,
        lastAnswer: null,
      });
      run.record.seats.push({
        seatId: description.id,
        controllerId,
        intent: run.record.request.intents?.[description.id] ?? null,
        counters: {
          decisions: 0,
          applied: 0,
          rejected: 0,
          unconfirmed: 0,
          timeout: 0,
          blocked: 0,
          effects: 0,
        },
      });
    }
    if (run.abort.signal.aborted) return;
    run.record.state = "setup";
    for (const seat of run.seats) {
      const first = await this.observe(run, seat, false);
      seat.expected = first.identity;
      this.seatRecord(run, seat).expected = first.identity;
      if (seat === run.seats[0]) run.record.expected = first.identity;
      if (run.abort.signal.aborted) return;
      if (
        (await this.control(run, seat, first, { kind: "release" }, "setup"))
          .status !== "applied"
      )
        throw new Error("Participant control handshake was not acknowledged.");
    }
    const expectedParticipants = run.seats.map((seat) => seat.controllerId);
    const participantsDeadline = performance.now() + 5000;
    let participants = await run.session.readParticipants();
    while (
      !expectedParticipants.every((id) =>
        participants.controllerIds.includes(id),
      )
    ) {
      if (run.abort.signal.aborted) return;
      if (performance.now() >= participantsDeadline)
        throw new Error(
          "seat_replaced: The connected room roster did not include every run player.",
        );
      await delay(25);
      participants = await run.session.readParticipants();
    }
    if (run.abort.signal.aborted) return;
    if (
      participants.roomId !== run.session.summary.roomId ||
      (run.record.request.target.kind === "owned" &&
        participants.controllerIds.length !== expectedParticipants.length)
    )
      throw new Error(
        "seat_replaced: Owned room membership does not match its controlled players.",
      );
    await this.trace(run, {
      kind: "participants_ready",
      gameSessionId: run.session.summary.gameSessionId,
      expected: run.record.expected,
      ...participants,
    });
    for (const step of profile.setup) {
      if (run.abort.signal.aborted) return;
      if (step.lane === "host") {
        const result = await run.session.invokeHost(step.actionId, step.input);
        await this.trace(run, {
          kind: "host_setup",
          actionId: step.actionId,
          result,
        });
      } else {
        const seat = run.seats.find(
          (candidate) => candidate.id === step.seatId,
        );
        if (!seat) throw new Error("Setup seat is not initialized.");
        const observation = await this.observe(run, seat, false);
        const receipt = await this.control(
          run,
          seat,
          observation,
          {
            kind: "action",
            actionId: step.actionId,
            input: step.input,
            deadlineMs: this.deadline(observation),
          },
          "setup",
        );
        if (
          receipt.status !== "applied" ||
          receipt.operation.kind !== "action" ||
          !receipt.operation.result.ok
        )
          throw new Error(`Setup action ${step.actionId} was not accepted.`);
      }
    }
    await this.persist(run);
  }
  async watch(
    input: unknown,
    onEvent: (event: GameRunWatchEvent) => void,
    signal: AbortSignal,
  ) {
    const request = gameRunWatchRequestSchema.parse(input);
    assertProcessScopesConfirmed();
    const run = this.runs.get(request.runId);
    if (
      !run ||
      run.record.request.target.kind !== "owned" ||
      !run.session ||
      !["setup", "playing"].includes(run.record.state)
    )
      throw new Error(
        "run_watch_unavailable: Only an active owned game can be watched.",
      );
    const surfaceKey = JSON.stringify(request.surface);
    if (run.watches.has(surfaceKey))
      throw new Error(
        "run_watch_duplicate: This surface already has a producer.",
      );
    if (run.watches.size >= 2)
      throw new Error("run_watch_limit: At most two surfaces can be produced.");
    const watcher =
      request.surface.kind === "host"
        ? run.session.watchHost
        : (() => {
            const seat = run.seats.find(
              (candidate) =>
                request.surface.kind === "controller" &&
                candidate.id === request.surface.seatId,
            );
            if (!seat)
              throw new Error(
                "run_watch_seat: This player does not belong to the run.",
              );
            return seat.participant.watch;
          })();
    const active = AbortSignal.any([signal, run.abort.signal]);
    active.throwIfAborted();
    run.record.watched = true;
    const operation = (async () => {
      await this.persist(run);
      await this.trace(
        run,
        { kind: "watch_started", surface: request.surface },
        true,
      );
      try {
        await watcher((event) => {
          if (active.aborted) return;
          onEvent(
            event.type === "ready"
              ? { ...event, runId: request.runId, surface: request.surface }
              : event,
          );
        }, active);
      } catch (error) {
        await this.trace(
          run,
          {
            kind: "watch_failed",
            surface: request.surface,
            message: error instanceof Error ? error.message : String(error),
          },
          true,
        );
        throw error;
      } finally {
        await this.trace(
          run,
          { kind: "watch_stopped", surface: request.surface },
          true,
        );
      }
    })();
    run.watches.set(surfaceKey, operation);
    try {
      await operation;
    } finally {
      run.watches.delete(surfaceKey);
    }
  }
  private seatRecord(run: Run, seat: RunSeat) {
    const record = run.record.seats.find(
      (candidate) => candidate.seatId === seat.id,
    );
    if (!record) throw new Error("Run seat has no receipt record.");
    return record;
  }
  private elapsed(run: Run) {
    return (
      run.record.request.budget.durationMs -
      Math.max(0, run.deadline - performance.now())
    );
  }
  /**
   * Answer a seat's question and keep that seat's running summary of how the
   * model played it: what it chose, what it missed, and stretches where it
   * stayed unsure, which often means the brief or the game was unclear.
   */
  private async answerFor(
    run: Run,
    seat: RunSeat,
    question: AirJamDecisionQuestion,
    deadline: number,
  ) {
    const record = this.seatRecord(run, seat);
    const answers = (record.answers ??= {
      asked: 0,
      answered: 0,
      missed: 0,
      lowConfidence: 0,
      lowConfidenceStretches: 0,
      choices: {},
    });
    answers.asked++;
    let answer: AnsweredDecision;
    try {
      answer = await this.answer(run, question, deadline);
    } catch (error) {
      answers.missed++;
      throw error;
    }
    answers.answered++;
    answers.choices[answer.choice] = (answers.choices[answer.choice] ?? 0) + 1;
    if (answer.confidence < LOW_CONFIDENCE) {
      answers.lowConfidence++;
      if (++seat.lowConfidenceStreak === LOW_CONFIDENCE_STRETCH)
        answers.lowConfidenceStretches++;
    } else seat.lowConfidenceStreak = 0;
    return answer;
  }
  /**
   * Put a policy's question to the run's decision model and map its choice back
   * to the option's own control. It shares the policy's decision deadline, and
   * a late, failed or undeclared answer is a missed decision, never a fallback.
   */
  private async answer(
    run: Run,
    question: AirJamDecisionQuestion,
    deadline: number,
  ): Promise<AnsweredDecision> {
    const decisions = this.options.decisions;
    if (!decisions)
      throw new Error(
        "decision_provider_unavailable: This run's policy asks a decision model, but none is configured.",
      );
    const remaining = deadline - performance.now();
    if (remaining <= 0)
      throw new Error("policy_timeout: Decision exceeded its deadline.");
    run.record.decisionModel ??= decisions.model;
    const started = performance.now();
    const timeout = AbortSignal.timeout(Math.ceil(remaining));
    let answered: DecisionAnswer;
    try {
      answered = await decisions.ask(
        question,
        AbortSignal.any([run.abort.signal, timeout]),
      );
    } catch (error) {
      if (timeout.aborted)
        throw new Error(
          "policy_timeout: Decision model exceeded its deadline.",
        );
      throw new Error(
        `decision_failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const option = Object.hasOwn(question.options, answered.choice)
      ? question.options[answered.choice]
      : undefined;
    if (!option)
      throw new Error(
        "decision_failed: Decision model chose an option the policy did not offer.",
      );
    return {
      ...answered,
      control: option.control,
      durationMs: performance.now() - started,
    };
  }
  private deadline(observation: HostObservation) {
    if (!observation.clock)
      throw new Error("Host does not advertise command admission deadlines.");
    return observation.clock.startedAtMs + PARTICIPANT_CONTROL_DEADLINE_MS;
  }
  private async observe(
    run: Run,
    seat: RunSeat,
    includeImage: boolean,
    diagnostic = false,
  ) {
    if (!run.record.profile) throw new Error("Run profile is not initialized.");
    const observation = await seat.participant.observe({
      scope: diagnostic ? "diagnostic" : run.record.profile.scope,
      includeImage,
      expected: seat.expected,
    });
    if (
      seat.expected &&
      !sameHostRuntimeIdentity(seat.expected, observation.identity)
    )
      throw new Error(
        "runtime_replaced: Observed a different host generation.",
      );
    if (observation.controllerId !== seat.controllerId)
      throw new Error(
        "seat_replaced: Observation belongs to a different player.",
      );
    this.trackPace(run, observation);
    return observation;
  }
  /**
   * How fast the host's simulation ran during play, against real time. A
   * starved host plays in slow motion, which quietly makes tests easier, so
   * the record says so.
   */
  private trackPace(run: Run, observation: HostObservation) {
    const pace = observation.pace;
    if (run.record.state !== "playing" || !pace) return;
    if (!run.paceStart || pace.wallMs < run.paceStart.wallMs) {
      run.paceStart = pace;
      return;
    }
    const wallMs = pace.wallMs - run.paceStart.wallMs;
    if (wallMs < 1000) return;
    run.record.hostPace = {
      framesPerSecond:
        Math.round(((pace.frames - run.paceStart.frames) / wallMs) * 10_000) /
        10,
      simulationSpeed:
        Math.round(
          ((pace.simulatedMs - run.paceStart.simulatedMs) / wallMs) * 100,
        ) / 100,
    };
  }
  private pruneReceipts(run: Run) {
    run.receipts = run.receipts.filter(
      (receipt) =>
        receipt.index > run.evaluationCursor ||
        receipt.sequence >
          (run.seats.find((seat) => seat.id === receipt.seatId)?.policyCursor ??
            0),
    );
  }
  private async evaluationObservation(run: Run, includeImage: boolean) {
    const primary = run.seats[0];
    if (!primary?.expected || run.seats.some((seat) => !seat.expected))
      throw new Error("Run has no fully initialized observation seats.");
    const checkSeats = () =>
      Promise.all(run.seats.map((seat) => seat.participant.checkConnected()));
    await checkSeats();
    const observation = await this.observe(run, primary, includeImage, true);
    await checkSeats();
    return observation;
  }
  private control(
    run: Run,
    seat: RunSeat,
    observation: Pick<HostObservation, "id" | "identity">,
    operation: ControllerLeasedControl["operation"],
    phase: "setup" | "play" | "cleanup",
  ) {
    if (phase !== "cleanup" && run.abort.signal.aborted)
      return Promise.reject(
        new Error("run_stopped: No new effects after Stop."),
      );
    const pending = this.applyControl(run, seat, observation, operation, phase);
    run.effects.add(pending);
    void pending
      .finally(() => run.effects.delete(pending))
      .catch(() => undefined);
    return pending;
  }
  private async applyControl(
    run: Run,
    seat: RunSeat,
    observation: Pick<HostObservation, "id" | "identity">,
    operation: ControllerLeasedControl["operation"],
    phase: "setup" | "play" | "cleanup",
  ) {
    const request = {
      expected: observation.identity,
      lease: { id: seat.leaseId, sequence: ++seat.sequence },
      operation,
    };
    let attempts: 1 | 2 = 1;
    let acknowledgement = await seat.participant.control(request);
    if (acknowledgement.status === "unconfirmed") {
      await this.trace(run, {
        kind: "control_attempt",
        seatId: seat.id,
        phase,
        observationId: observation.id,
        sequence: seat.sequence,
        operation,
        receipt: acknowledgement,
      });
      attempts = 2;
      acknowledgement = await seat.participant.control(request);
    }
    run.record.counters[
      acknowledgement.status === "applied"
        ? "applied"
        : acknowledgement.status === "rejected"
          ? "rejected"
          : "unconfirmed"
    ]++;
    this.seatRecord(run, seat).counters[
      acknowledgement.status === "applied"
        ? "applied"
        : acknowledgement.status === "rejected"
          ? "rejected"
          : "unconfirmed"
    ]++;
    if (
      phase === "play" &&
      acknowledgement.status === "applied" &&
      operation.kind !== "release" &&
      (acknowledgement.operation.kind !== "action" ||
        acknowledgement.operation.result.ok)
    )
      this.seatRecord(run, seat).counters.effects++;
    const receipt: AirJamRunReceipt = {
      index: ++run.receiptIndex,
      seatId: seat.id,
      phase,
      sequence: seat.sequence,
      attempts,
      operation,
      acknowledgement,
    };
    run.receipts.push(receipt);
    await this.trace(run, {
      kind: "control",
      observationId: observation.id,
      ...receipt,
    });
    return acknowledgement;
  }
  private evaluate(
    run: Run,
    phase: "play" | "final",
    observation?: HostObservation,
  ) {
    if (run.evaluation)
      throw new Error("evaluator_busy: A previous evaluation is pending.");
    const primary = run.seats[0];
    const evaluator = run.evaluator;
    if (!primary || !evaluator)
      throw new Error("Scenario evaluator is not initialized.");
    const through = run.receiptIndex;
    const receipts = run.receipts.filter(
      (receipt) =>
        receipt.index > run.evaluationCursor && receipt.index <= through,
    );
    const pending = (async () => {
      const sample =
        observation ?? (await this.evaluationObservation(run, false));
      run.evaluationCursor = through;
      if (phase === "play") run.playEvaluationSent = true;
      const verdict = await evaluator.evaluate(
        {
          phase,
          observation: sample,
          seats: run.seats.map((seat) => ({
            seatId: seat.id,
            controllerId: seat.controllerId,
          })),
          receipts,
          elapsedMs: this.elapsed(run),
        },
        1000,
      );
      run.record.evaluation ??= {};
      run.record.evaluation[phase] = verdict;
      await this.trace(run, {
        kind: "evaluation",
        phase,
        observationId: sample.id,
        through,
        verdict,
      });
      this.pruneReceipts(run);
      return verdict;
    })();
    run.evaluation = pending;
    void pending
      .finally(() => {
        if (run.evaluation === pending) run.evaluation = undefined;
      })
      .catch(() => undefined);
    return pending;
  }
  private async play(run: Run) {
    const profile = run.record.profile;
    const policy = run.policy;
    const primary = run.seats[0];
    if (!profile || !policy || !primary)
      throw new Error("Run policy is not initialized.");
    run.record.state = "playing";
    await this.persist(run);
    let lastTick: number | null = null;
    let progressedAt = performance.now();
    while (!run.abort.signal.aborted) {
      const roundStarted = performance.now();
      if (
        roundStarted >= run.deadline ||
        run.record.counters.steps >= run.record.request.budget.steps
      )
        return this.terminate(
          run,
          "budget",
          "Run reached its bounded play budget.",
        );
      let verdict: AirJamScenarioVerdict;
      try {
        verdict = await this.evaluate(run, "play");
      } catch (error) {
        if (run.abort.signal.aborted) return;
        if (
          !(error instanceof Error) ||
          !/^policy_(timeout|busy):/.test(error.message)
        )
          throw error;
        return this.terminate(
          run,
          "evaluator_unresponsive",
          error instanceof Error ? error.message : String(error),
        );
      }
      if (run.abort.signal.aborted) return;
      if (verdict.status === "failed")
        return this.terminate(
          run,
          "failed",
          verdict.message ?? "Scenario failed.",
        );
      if (verdict.status === "passed") {
        const tested = run.record.seats.every(
          (seat) => seat.counters.effects > 0,
        );
        return this.terminate(
          run,
          tested ? "completed" : "untested_seat",
          tested
            ? (verdict.message ?? "Scenario passed.")
            : "The scenario passed before every seat produced an applied play effect.",
        );
      }
      for (const seat of run.seats) {
        if (run.abort.signal.aborted) return;
        if (run.record.counters.steps >= run.record.request.budget.steps)
          return this.terminate(
            run,
            "budget",
            "Run reached its decision budget.",
          );
        const started = performance.now();
        const observation = await this.observe(
          run,
          seat,
          run.record.request.target.kind === "owned" && profile.includeImage,
        );
        if (run.abort.signal.aborted) return;
        const tick = observation.ticks.after;
        if (tick !== lastTick) {
          lastTick = tick;
          progressedAt = performance.now();
        }
        if (
          observation.host?.after?.connectionStatus !== "connected" ||
          observation.host.after.runtimeState !== "playing" ||
          (tick !== null && performance.now() - progressedAt > 5000)
        )
          return this.terminate(
            run,
            "host_not_advancing",
            "The observed host stopped advancing.",
          );
        const step = ++run.record.counters.steps;
        const counters = this.seatRecord(run, seat).counters;
        let control: AirJamPlayControl;
        try {
          if (policy.busy()) {
            counters.blocked++;
            throw new Error("policy_busy: Previous decision has not returned.");
          }
          const receipts = run.receipts.filter(
            (receipt) =>
              receipt.seatId === seat.id &&
              receipt.sequence > seat.policyCursor,
          );
          seat.policyCursor = seat.sequence;
          counters.decisions++;
          const decisionStarted = performance.now();
          const decisionDeadline =
            decisionStarted +
            Math.min(
              profile.timing.decisionMs,
              Math.max(1, run.deadline - decisionStarted),
            );
          const decision = await policy.decide(
            {
              observation,
              seatId: seat.id,
              intent: this.seatRecord(run, seat).intent,
              answer: seat.lastAnswer,
              step,
              elapsedMs: this.elapsed(run),
              receipts,
            },
            decisionDeadline - decisionStarted,
          );
          let answer: AnsweredDecision | undefined;
          if ("ask" in decision) {
            // A missed answer must not leave the previous choice to act on.
            seat.lastAnswer = null;
            answer = await this.answerFor(
              run,
              seat,
              decision.ask,
              decisionDeadline,
            );
            control = answer.control;
            seat.lastAnswer = {
              choice: answer.choice,
              confidence: answer.confidence,
            };
          } else control = decision.control;
          if (run.abort.signal.aborted) return;
          await this.trace(run, {
            kind: "policy_decision",
            seatId: seat.id,
            step,
            durationMs: performance.now() - decisionStarted,
            ...(decision.diagnostics
              ? { diagnostics: decision.diagnostics }
              : {}),
            ...(answer
              ? {
                  answer: {
                    choice: answer.choice,
                    confidence: answer.confidence,
                    durationMs: answer.durationMs,
                  },
                }
              : {}),
          });
          this.pruneReceipts(run);
        } catch (error) {
          if (run.abort.signal.aborted) return;
          if (
            !(error instanceof Error) ||
            !/^(policy_(timeout|busy)|decision_failed):/.test(error.message)
          )
            throw error;
          if (error.message.startsWith("policy_timeout:")) counters.timeout++;
          run.record.counters.missed++;
          const reason = error.message.slice(0, 300);
          await this.trace(run, {
            kind: "decision_missed",
            seatId: seat.id,
            step,
            reason,
          });
          await this.control(
            run,
            seat,
            observation,
            { kind: "release" },
            "play",
          );
          if (++seat.misses >= 3)
            return this.terminate(
              run,
              "policy_unresponsive",
              `Seat ${seat.id} missed three consecutive decision opportunities. Last: ${reason}`,
            );
          continue;
        }
        if (run.abort.signal.aborted) return;
        seat.misses = 0;
        const operation: ControllerLeasedControl["operation"] =
          control.kind === "release"
            ? { kind: "release" }
            : control.kind === "input"
              ? {
                  ...control,
                  ttlMs: profile.timing.inputTtlMs,
                  deadlineMs: this.deadline(observation),
                }
              : { ...control, deadlineMs: this.deadline(observation) };
        if (
          operation.kind === "action" &&
          !profile.actions.includes(operation.actionId)
        )
          throw new Error(
            "policy_action_forbidden: Decision requested an action outside the profile.",
          );
        const receipt = await this.control(
          run,
          seat,
          observation,
          operation,
          "play",
        );
        if (receipt.status === "unconfirmed")
          throw new Error(`control_unconfirmed: ${receipt.reason}`);
        if (receipt.status === "rejected") {
          if (receipt.reason === "stale_identity")
            return this.terminate(
              run,
              "runtime_replaced",
              "The game runtime was replaced.",
            );
          if (receipt.reason !== "stale_decision")
            throw new Error(`control_rejected: ${receipt.reason}`);
          run.record.counters.missed++;
          await this.control(
            run,
            seat,
            observation,
            { kind: "release" },
            "play",
          );
          if (++seat.staleDecisions >= 3)
            return this.terminate(
              run,
              "decision_latency",
              `Seat ${seat.id} repeatedly arrived too late to apply.`,
            );
        } else seat.staleDecisions = 0;
        await this.trace(run, {
          kind: "decision",
          seatId: seat.id,
          step,
          observationId: observation.id,
          tick,
          durationMs: performance.now() - started,
        });
      }
      await delay(
        Math.max(
          0,
          profile.timing.intervalMs - (performance.now() - roundStarted),
        ),
        undefined,
        { signal: run.abort.signal },
      ).catch((error) => {
        if (!run.abort.signal.aborted) throw error;
      });
    }
  }
  private failed(run: Run, error: unknown) {
    if (run.abort.signal.aborted) return;
    const message = error instanceof Error ? error.message : String(error);
    void this.terminate(run, failureReason(message), message).catch((failure) =>
      console.error(failure),
    );
  }
  private terminate(run: Run, reason: EndReason, message: string) {
    return (run.termination ??= (async () => {
      run.abort.abort();
      clearTimeout(run.timer);
      run.record.state = "stopping";
      run.record.end = {
        reason,
        outcome: "inconclusive",
        message,
      };
      const cleanup: NonNullable<AirJamGameRunRecord["cleanup"]> = {
        seats: [],
        errors: [],
        participantsClosed: true,
      };
      const attempt = async <T>(operation: () => Promise<T>) => {
        try {
          return await operation();
        } catch (error) {
          cleanup.errors.push(
            error instanceof Error ? error.message : String(error),
          );
          return undefined;
        }
      };
      await attempt(async () => {
        await run.admission;
        await run.startup;
      });
      await Promise.allSettled([...run.watches.values()]);
      const policy = run.policy;
      if (policy) await attempt(() => policy.stop());
      await Promise.allSettled([...run.effects]);
      const evaluationInFlight = run.evaluation;
      if (evaluationInFlight) await attempt(() => evaluationInFlight);
      if (run.session) {
        const session = run.session;
        for (const seat of run.seats) {
          const seatCleanup: NonNullable<
            AirJamGameRunRecord["cleanup"]
          >["seats"][number] = { seatId: seat.id };
          cleanup.seats.push(seatCleanup);
          if (seat.expected) {
            const expected = seat.expected;
            seatCleanup.release = await attempt(() =>
              this.control(
                run,
                seat,
                { identity: expected, id: "cleanup" },
                { kind: "release" },
                "cleanup",
              ),
            );
          }
          seat.policyCursor = seat.sequence;
        }
        const primary = run.seats[0];
        let finalObservation: HostObservation | undefined;
        try {
          if (!primary || !run.record.profile)
            throw new Error("Run has no initialized observation seat.");
          const before = await this.evaluationObservation(run, false);
          const settleUntil = performance.now() + 2000;
          let settled: HostObservation;
          do {
            await delay(run.record.profile.timing.intervalMs);
            settled = await this.evaluationObservation(run, false);
          } while (
            before.ticks.after !== null &&
            settled.ticks.after === before.ticks.after &&
            performance.now() < settleUntil
          );
          if (
            before.ticks.after !== null &&
            settled.ticks.after === before.ticks.after
          )
            throw new Error("The host did not advance after input release.");
          finalObservation = await this.evaluationObservation(run, true);
          const source = `${JSON.stringify(finalObservation)}\n`;
          const file = await open(
            path.join(run.directory, "final-observation.json"),
            "w",
            0o600,
          );
          try {
            await file.writeFile(source);
          } finally {
            await file.close();
          }
          run.record.evidence = {
            ...run.record.evidence,
            observation: {
              path: `.airjam/artifacts/runs/${run.record.runId}/final-observation.json`,
              sha256: createHash("sha256").update(source).digest("hex"),
            },
            error: null,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          run.record.evidence = {
            ...run.record.evidence,
            observation: null,
            error: message,
          };
          if (run.record.end.reason === "completed")
            run.record.end = {
              reason: failureReason(message),
              outcome: "inconclusive",
              message,
            };
        }
        if (finalObservation && run.evaluator && run.playEvaluationSent)
          await attempt(() => this.evaluate(run, "final", finalObservation));
        const evaluator = run.evaluator;
        if (evaluator) await attempt(() => evaluator.stop());
        for (const seat of run.seats.slice(1)) {
          const extra = seat.extra;
          if (!extra)
            throw new Error("Additional run seat has no owned participant.");
          let disconnected = await attempt(() => extra.close());
          if (!disconnected)
            disconnected = await attempt(() => extra.forceClose());
          if (!disconnected) cleanup.participantsClosed = false;
          const receipt = cleanup.seats.find(
            (candidate) => candidate.seatId === seat.id,
          );
          if (!receipt) throw new Error("Run seat has no cleanup receipt.");
          receipt.disconnection = disconnected;
          await attempt(() =>
            this.trace(run, {
              kind: "seat_left",
              seatId: seat.id,
              disconnection: disconnected,
            }),
          );
        }
        let closed = await attempt(() => session.close());
        if (!closed?.closed) {
          cleanup.forced = true;
          closed = await attempt(() => session.forceClose());
        }
        if (closed) {
          run.closed = closed;
          cleanup.close = {
            closed: closed.closed,
            disconnection: closed.disconnection,
          };
          run.record.session = gameRunSessionIdentitySchema.parse(
            closed.session,
          );
        }
      }
      const evaluator = run.evaluator;
      if (!run.session && evaluator) await attempt(() => evaluator.stop());
      const scopes = await Promise.allSettled(
        run.scopes.map((close) => close()),
      );
      cleanup.processesClosed = scopes.every(
        (result) => result.status === "fulfilled",
      );
      try {
        assertProcessScopesConfirmed();
      } catch (error) {
        cleanup.processesClosed = false;
        cleanup.errors.push(
          error instanceof Error ? error.message : String(error),
        );
      }
      for (const result of scopes)
        if (result.status === "rejected")
          cleanup.errors.push(
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          );
      const evaluation = run.record.evaluation;
      if (
        evaluation?.play?.status === "failed" ||
        evaluation?.final?.status === "failed"
      ) {
        run.record.end = {
          reason: "failed",
          outcome: "failed",
          message:
            (evaluation.final?.status === "failed"
              ? evaluation.final
              : evaluation.play
            )?.message ?? "Scenario failed.",
        };
      } else if (run.record.end.reason === "completed") {
        const released =
          cleanup.seats.length === run.record.seats.length &&
          cleanup.seats.every((seat) => seat.release?.status === "applied");
        run.record.end.outcome =
          evaluation?.final?.status === "passed" &&
          run.record.evidence?.observation &&
          cleanup.errors.length === 0 &&
          cleanup.close?.closed &&
          released &&
          cleanup.participantsClosed &&
          cleanup.processesClosed
            ? "passed"
            : "inconclusive";
        if (run.record.end.outcome === "inconclusive")
          run.record.end.message =
            cleanup.errors[0] ??
            (!released
              ? "Cleanup did not confirm every input release."
              : "The final evaluation did not confirm the earlier pass.");
      }
      if (run.build && run.record.build) {
        try {
          await verifyPinnedGameBuild(run.build);
          run.record.build.integrity = "verified";
        } catch (error) {
          run.record.build.integrity = "changed";
          run.record.end = {
            reason: "runtime_replaced",
            outcome: "inconclusive",
            message: error instanceof Error ? error.message : String(error),
          };
        }
      }
      run.record.cleanup = cleanup;
      run.record.endedAt = new Date().toISOString();
      run.record.state = "ended";
      if (run.traceTruncated)
        run.record.end = {
          reason: "trace_budget",
          outcome: "inconclusive",
          message:
            "Trace byte allowance was exhausted; evidence is incomplete.",
        };
      await attempt(() =>
        this.trace(run, { kind: "ended", end: run.record.end, cleanup }),
      );
      await attempt(async () => {
        const bytes = await readGameRunArtifact(
          this.options.projectDir,
          run.record.runId,
          "trace.ndjson",
          MAXIMUM_GAME_RUN_TRACE_BYTES,
        );
        if (!bytes) throw new Error("Run trace is missing.");
        run.record.evidence ??= { observation: null, error: null };
        run.record.evidence.trace = {
          path: `.airjam/artifacts/runs/${run.record.runId}/trace.ndjson`,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          bytes: bytes.byteLength,
          truncated: run.traceTruncated,
        };
      });
      if (
        run.record.end.outcome === "passed" &&
        (cleanup.errors.length || run.traceTruncated)
      )
        run.record.end = {
          reason: run.traceTruncated ? "trace_budget" : "error",
          outcome: "inconclusive",
          message: cleanup.errors[0] ?? "Trace byte allowance was exhausted.",
        };
      await this.persist(run);
      if (run.session && cleanup.close?.closed && cleanup.participantsClosed)
        this.options.sessionClosed(run.session.summary.gameSessionId);
      this.prune();
    })().finally(() => run.finished.abort()));
  }
}
