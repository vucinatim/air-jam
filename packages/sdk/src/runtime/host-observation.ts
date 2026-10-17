import { nanoid } from "nanoid";
import { agentJson } from "../agent/agent-evaluator";
import type {
  HostAgentRequest,
  HostAgentResponse,
} from "./contracts/agent-control";
import {
  HOST_OBSERVATION_TIMEOUT_MS,
  hostObservationRequestSchema,
  hostObservationSchema,
  type HostObservation,
  type HostObservationRequest,
  type HostObservationSurface,
} from "./contracts/observation";
import {
  notifyHostRuntimeChanged,
  sameHostRuntimeIdentity,
  type HostObservationIdentity,
} from "./contracts/runtime-identity";

const surfaces = new WeakMap<
  object,
  Map<string, Set<HostObservationSurface & { id: string }>>
>();
const sequences = new WeakMap<object, number>();

async function beforeDeadline<T>(
  task: () => T | Promise<T>,
  deadline: number,
): Promise<T> {
  const expired = () =>
    new Error("observation_timeout: Game observation exceeded its deadline.");
  if (performance.now() >= deadline) throw expired();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(expired()),
          Math.max(0, deadline - performance.now()),
        );
      }),
      task(),
    ]);
    if (performance.now() > deadline) throw expired();
    return result;
  } finally {
    clearTimeout(timer);
  }
}

export function registerHostObservationSurface(
  target: object,
  roomId: string,
  surface: HostObservationSurface,
) {
  let rooms = surfaces.get(target);
  if (!rooms) {
    rooms = new Map();
    surfaces.set(target, rooms);
  }
  const bindings = rooms.get(roomId) ?? new Set();
  const registration = { ...surface, id: nanoid() };
  bindings.add(registration);
  rooms.set(roomId, bindings);
  notifyHostRuntimeChanged(target, roomId);
  return () => {
    if (!bindings.delete(registration)) return;
    if (!bindings.size) rooms.delete(roomId);
    if (!rooms.size && surfaces.get(target) === rooms) surfaces.delete(target);
    notifyHostRuntimeChanged(target, roomId);
  };
}

function surfaceFor(target: object, roomId: string) {
  const bindings = surfaces.get(target)?.get(roomId);
  if (bindings && bindings.size > 1)
    throw new Error(
      "observation_surface_ambiguous: Multiple surfaces own this room.",
    );
  return bindings?.values().next().value ?? null;
}

export function readHostObservationSurfaceId(target: object, roomId: string) {
  return surfaceFor(target, roomId)?.id ?? null;
}

export async function observeHostRuntime(
  target: object,
  input: HostObservationRequest,
  owner: {
    read: (request: HostAgentRequest) => Promise<HostAgentResponse>;
    sample: () => {
      identity: HostObservationIdentity | null;
      capabilities: NonNullable<HostObservation["capabilities"]>;
      host: NonNullable<HostObservation["host"]>["before"];
    };
  },
) {
  const request = hostObservationRequestSchema.parse(input);
  const startedAt = performance.now();
  const deadline = startedAt + HOST_OBSERVATION_TIMEOUT_MS;
  const capturedAt = new Date().toISOString();
  const semantic = async () => {
    const result = await beforeDeadline(
      () =>
        owner.read({
          operation: "read",
          roomId: request.roomId,
          controllerId: request.controllerId,
        }),
      deadline,
    );
    if (result.operation !== "read" || !result.snapshot)
      throw new Error(
        "contract_runtime_unavailable: No live observation contract.",
      );
    return result.snapshot;
  };
  const before = await semantic();
  const surface = surfaceFor(target, request.roomId);
  const beforeSample = owner.sample();
  const identity = beforeSample.identity;
  if (
    !identity ||
    identity.contractId !== before.contractId ||
    identity.runtimeId !== before.runtimeId
  )
    throw new Error(
      "observation_replaced: The runtime changed before capture.",
    );
  const expected = request.expected;
  if (expected && !sameHostRuntimeIdentity(identity, expected))
    throw new Error(
      "observation_replaced: The requested game observation changed.",
    );
  const runtime = surface ? agentJson(surface.read(request)) : null;
  const capture = surface?.capture;
  const image =
    request.includeImage && capture
      ? await beforeDeadline(capture, deadline)
      : null;
  const runtimeAfter = surface ? agentJson(surface.read(request)) : null;
  const after = await semantic();
  const afterSample = owner.sample();
  const afterIdentity = afterSample.identity;
  if (
    !afterIdentity ||
    !sameHostRuntimeIdentity(identity, afterIdentity) ||
    before.contractId !== after.contractId ||
    before.runtimeId !== after.runtimeId ||
    surfaceFor(target, request.roomId) !== surface
  )
    throw new Error(
      "observation_replaced: The game changed during observation.",
    );
  const sequence = (sequences.get(target) ?? 0) + 1;
  sequences.set(target, sequence);
  const revisions = (snapshot: typeof before) =>
    snapshot.rawStores.map(({ storeDomain, revision }) => ({
      storeDomain,
      revision,
    }));
  return hostObservationSchema.parse({
    version: 1,
    id: nanoid(),
    identity,
    sequence,
    scope: request.scope,
    controllerId: request.controllerId,
    host: { before: beforeSample.host, after: afterSample.host },
    capabilities: beforeSample.capabilities,
    actions: before.actions,
    capturedAt,
    clock: { startedAtMs: startedAt, finishedAtMs: performance.now() },
    durationMs: performance.now() - startedAt,
    snapshot: before.snapshot,
    runtime: runtime?.state ?? null,
    ticks: { before: runtime?.tick ?? null, after: runtimeAfter?.tick ?? null },
    stores: { before: revisions(before), after: revisions(after) },
    visual: image
      ? { status: "captured", image }
      : {
          status: "unavailable",
          reason: !request.includeImage
            ? "not-requested"
            : surface?.capture
              ? "surface-unavailable"
              : "unsupported",
        },
  });
}
