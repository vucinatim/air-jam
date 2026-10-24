import { nanoid } from "nanoid";
import { z } from "zod";
import type { AnyAirJamAgentContract } from "../../agent/agent-contract";
import {
  agentJson,
  createAirJamAgentEvaluator,
} from "../../agent/agent-evaluator";
import type { HostInput } from "../../core/host-input";
import { roomCodeSchema } from "../../protocol/core";
import type {
  ControllerLeasedControl,
  ControllerLeasedControlAck,
} from "../../protocol/leased-control";
import type { AirJamActionInvocationResult } from "../../protocol/sync";
import { isRpcSerializable } from "../../utils/is-rpc-serializable";
import {
  observeHostRuntime,
  readHostObservationSurfaceId,
} from "../host-observation";
import { ParticipantControl } from "../participant-control";
import {
  hostAgentRequestSchema,
  type HostAgentRequest,
  type HostAgentResponse,
} from "./agent-control";
import type { HostObservation } from "./observation";
import {
  notifyHostRuntimeChanged,
  subscribeHostRuntimeChanges,
} from "./runtime-identity";

/** Callable only inside the owning browser realm; never a network endpoint. */
export const AIR_JAM_RUNTIME_CONTROL_KEY = "__AIR_JAM_RUNTIME_CONTROL__";

const hostRuntimeActionRequestSchema = z
  .object({
    roomId: roomCodeSchema,
    storeDomain: z.string().trim().min(1).max(128),
    actionName: z.string().trim().min(1).max(128),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type HostRuntimeActionRequest = z.infer<
  typeof hostRuntimeActionRequestSchema
>;

export interface HostRuntimeControl {
  agent(request: HostAgentRequest): Promise<HostAgentResponse>;
  invoke(
    request: HostRuntimeActionRequest,
  ): Promise<AirJamActionInvocationResult>;
}

type ActionStore = {
  roomId: string;
  storeDomain: string;
  stateEpoch: string;
  contractStoreDomain: string;
  read: () => { data: Record<string, unknown>; revision: number };
  invoke: (
    request: HostRuntimeActionRequest,
  ) => Promise<AirJamActionInvocationResult>;
  dispatchParticipant: (request: {
    controllerId: string;
    actionName: string;
    payload: Record<string, unknown> | undefined;
  }) => AirJamActionInvocationResult;
};

type ParticipantReceiver = {
  /** The host clock that command deadlines and input leases run on. */
  now: () => number;
  readState: () => NonNullable<NonNullable<HostObservation["host"]>["before"]>;
  isParticipant: (controllerId: string) => boolean;
  input?: Pick<
    HostInput,
    | "describeInputSchema"
    | "claimLeasedInput"
    | "supportsLeasedInput"
    | "setLeasedInput"
    | "releaseLeasedInput"
    | "clearInput"
    | "clearLeasedInputs"
  >;
};

const controls = new WeakMap<
  object,
  {
    stores: Map<string, Set<ActionStore>>;
    contracts: Set<{
      id: string;
      roomId: string;
      gameId: string;
      evaluator: ReturnType<typeof createAirJamAgentEvaluator>;
    }>;
    control: HostRuntimeControl;
    participants: Map<string, ParticipantControl>;
    unsubscribe: () => void;
    receivers: Map<string, ParticipantReceiver & { id: string }>;
  }
>();

export const hostStateEpochSchema = z.object({
  storeDomain: z.string().min(1).max(128),
  epoch: z.string().min(1).max(128),
});

const documentIds = new WeakMap<object, string>();

export function hostRuntimeDocumentId(target: object) {
  let id = documentIds.get(target);
  if (!id) {
    id = nanoid();
    documentIds.set(target, id);
  }
  return id;
}

const reject = (
  reason: string,
  message: string,
): AirJamActionInvocationResult => ({
  ok: false,
  status: "rejected",
  source: "host",
  reason,
  message,
});

const storeKey = (roomId: string, storeDomain: string): string =>
  JSON.stringify([roomId, storeDomain]);

function resolveRoomRuntime(target: object, roomId: string) {
  const entry = controls.get(target);
  const active = [...(entry?.contracts ?? [])].filter(
    (binding) => binding.roomId === roomId,
  );
  if (active.length > 1)
    throw new Error(
      "contract_runtime_ambiguous: More than one contract owns this room.",
    );
  const binding = active[0];
  if (!binding || !entry) return null;
  const description = binding.evaluator.describe();
  const selected = description.snapshotStoreDomains.map((domain) => {
    const matches = [...entry.stores.values()]
      .flatMap((value) => [...value])
      .filter(
        (store) =>
          store.roomId === roomId && store.contractStoreDomain === domain,
      );
    if (matches.length !== 1)
      throw new Error(
        matches.length ? "host_store_ambiguous" : "host_store_unavailable",
      );
    return { domain, store: matches[0] };
  });
  const documentId = hostRuntimeDocumentId(target);
  const runtimeId = JSON.stringify([
    documentId,
    roomId,
    selected.map(({ domain, store }) => [domain, store.stateEpoch]),
  ]);
  return {
    binding,
    description,
    selected,
    identity: { documentId, roomId, contractId: binding.id, runtimeId },
  };
}

export function readHostRuntimeIdentity(target: object, roomId: string) {
  const runtime = resolveRoomRuntime(target, roomId);
  return runtime
    ? {
        ...runtime.identity,
        surfaceId: readHostObservationSurfaceId(target, roomId),
        participantId: controls.get(target)?.receivers.get(roomId)?.id ?? null,
      }
    : null;
}

function controlEntry(target: object) {
  let entry = controls.get(target);
  if (!entry) {
    const stores = new Map<string, Set<ActionStore>>();
    const participants = new Map<string, ParticipantControl>();
    const receivers: NonNullable<ReturnType<typeof controls.get>>["receivers"] =
      new Map();
    const contracts: NonNullable<ReturnType<typeof controls.get>>["contracts"] =
      new Set();
    const control: HostRuntimeControl = {
      async agent(input) {
        const request = hostAgentRequestSchema.parse(input);
        if (request.operation === "observe") {
          const { operation, ...observationRequest } = request;
          return {
            operation,
            observation: await observeHostRuntime(target, observationRequest, {
              read: (read) => control.agent(read),
              sample: () => {
                const receiver = receivers.get(request.roomId);
                const input = receiver?.input;
                return {
                  identity: readHostRuntimeIdentity(target, request.roomId),
                  now: receiver?.now ?? null,
                  host: receiver?.readState() ?? null,
                  capabilities: {
                    participantControl: {
                      ...(input
                        ? { inputSchema: input.describeInputSchema() }
                        : {}),
                      ...(input?.supportsLeasedInput
                        ? { input: 1 as const }
                        : {}),
                      ...(receiver &&
                      resolveRoomRuntime(
                        target,
                        request.roomId,
                      )?.description.actions.some(
                        (action) => action.target.kind === "participant",
                      )
                        ? { actions: 1 as const }
                        : {}),
                    },
                  },
                };
              },
            }),
          };
        }
        const runtime = resolveRoomRuntime(target, request.roomId);
        if (!runtime) {
          if (request.operation === "read")
            return { operation: "read", snapshot: null };
          throw new Error(
            "contract_runtime_unavailable: No live game contract is registered.",
          );
        }
        const {
          binding,
          description,
          selected,
          identity: { runtimeId },
        } = runtime;
        if (request.operation !== "read") {
          if (request.contractId !== binding.id)
            throw new Error(
              "contract_changed: Read the current contract before invoking an action.",
            );
          if (request.runtimeId !== runtimeId)
            throw new Error(
              "runtime_replaced: The game's store runtime was replaced.",
            );
          const resolved = binding.evaluator.resolve(
            request.actionId,
            request.payload,
            binding.gameId,
          );
          const store = selected.find(
            (item) => item.domain === resolved.target.storeDomain,
          )?.store;
          if (!store)
            throw new Error(
              "host_store_unavailable: Action targets an undeclared store.",
            );
          const result = {
            operation: request.operation,
            target: { ...resolved.target, storeDomain: store.storeDomain },
            payload: resolved.payload,
          };
          if (
            request.operation === "invoke-host" &&
            resolved.target.kind !== "host"
          )
            throw new Error(
              "invalid_action_lane: Host invocation requires a host action.",
            );
          return request.operation === "invoke-host"
            ? {
                ...result,
                acknowledgement: agentJson(
                  await control.invoke({
                    roomId: request.roomId,
                    storeDomain: store.storeDomain,
                    actionName: resolved.target.actionName,
                    payload: resolved.payload,
                  }),
                ),
              }
            : result;
        }
        const rawStores = selected.map(({ store }) => ({
          storeDomain: store.storeDomain,
          ...agentJson(store.read()),
          updatedAt: new Date().toISOString(),
        }));
        const snapshot = await binding.evaluator.project({
          controllerId: request.controllerId,
          stores: Object.fromEntries(
            selected.map(({ domain }, index) => [
              domain,
              rawStores[index].data,
            ]),
          ),
        });
        if (
          !contracts.has(binding) ||
          [...contracts].filter(
            (candidate) => candidate.roomId === request.roomId,
          ).length !== 1
        )
          throw new Error(
            "contract_changed: Contract changed while projecting state.",
          );
        if (
          !selected.every(
            ({ store }) =>
              stores.get(storeKey(store.roomId, store.storeDomain))?.size ===
                1 &&
              stores.get(storeKey(store.roomId, store.storeDomain))?.has(store),
          )
        )
          throw new Error(
            "runtime_replaced: Store changed while projecting state.",
          );
        return {
          operation: "read",
          snapshot: {
            ...description,
            contractId: binding.id,
            runtimeId,
            snapshot,
            rawStores,
            storeDomainBindings: selected.map(({ domain, store }) => ({
              contractStoreDomain: domain,
              runtimeStoreDomain: store.storeDomain,
            })),
          },
        };
      },
      async invoke(request) {
        const parsed = hostRuntimeActionRequestSchema.safeParse(request);
        if (
          !parsed.success ||
          !isRpcSerializable(request.payload) ||
          parsed.data.actionName.startsWith("_")
        ) {
          return reject(
            "invalid_host_action",
            "Host actions require a valid room, store, public action and serializable object payload.",
          );
        }
        const matches = stores.get(
          storeKey(parsed.data.roomId, parsed.data.storeDomain),
        );
        if (!matches?.size)
          return reject(
            "host_store_unavailable",
            "The requested host store is not active in this browser realm.",
          );
        if (matches.size !== 1)
          return reject(
            "host_store_ambiguous",
            "More than one host store owns this room and domain.",
          );
        const [store] = matches;
        return store.invoke(parsed.data);
      },
    };
    const unsubscribe = subscribeHostRuntimeChanges(target, (roomId) =>
      participants.get(roomId)?.invalidateInput(),
    );
    entry = {
      stores,
      contracts,
      control,
      receivers,
      participants,
      unsubscribe,
    };
    controls.set(target, entry);
  }
  return entry;
}

function discardUnusedEntry(
  target: object,
  entry: ReturnType<typeof controlEntry>,
) {
  if (entry.stores.size || entry.contracts.size || entry.receivers.size) return;
  if (Reflect.get(target, AIR_JAM_RUNTIME_CONTROL_KEY) === entry.control)
    Reflect.deleteProperty(target, AIR_JAM_RUNTIME_CONTROL_KEY);
  if (controls.get(target) === entry) {
    entry.unsubscribe();
    controls.delete(target);
  }
}

export function readHostStateEpochs(target: object, roomId: string) {
  const epochs: z.infer<typeof hostStateEpochSchema>[] = [];
  for (const stores of controls.get(target)?.stores.values() ?? []) {
    const latest = [...stores].at(-1);
    if (latest?.roomId === roomId)
      epochs.push({
        storeDomain: latest.storeDomain,
        epoch: latest.stateEpoch,
      });
  }
  return epochs.sort((first, second) =>
    first.storeDomain.localeCompare(second.storeDomain),
  );
}

export function subscribeHostStateOwners(target: object, listener: () => void) {
  return subscribeHostRuntimeChanges(target, listener);
}

export function registerHostRuntimeParticipantReceiver(
  target: object,
  roomId: string,
  receiver: ParticipantReceiver,
) {
  const entry = controlEntry(target);
  if (entry.receivers.has(roomId))
    throw new Error(
      "host_participant_ambiguous: More than one participant receiver owns this room.",
    );
  const registration = { ...receiver, id: nanoid() };
  entry.receivers.set(roomId, registration);
  notifyHostRuntimeChanged(target, roomId);
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    if (entry.receivers.get(roomId) !== registration) return;
    entry.receivers.delete(roomId);
    receiver.input?.clearLeasedInputs();
    notifyHostRuntimeChanged(target, roomId);
    discardUnusedEntry(target, entry);
  };
}

function participantControl(target: object, roomId: string) {
  const entry = controls.get(target);
  if (!entry) return null;
  let participant = entry.participants.get(roomId);
  if (!participant) {
    participant = new ParticipantControl({
      identity: () => readHostRuntimeIdentity(target, roomId),
      now: () => {
        const receiver = entry.receivers.get(roomId);
        if (!receiver)
          throw new Error(
            "host_participant_unavailable: No host owns this room.",
          );
        return receiver.now();
      },
      input: () => entry.receivers.get(roomId)?.input,
      isParticipant: (controllerId) =>
        entry.receivers.get(roomId)?.isParticipant(controllerId) ?? false,
      dispatch: (controllerId, operation) => {
        const runtime = resolveRoomRuntime(target, roomId);
        if (!runtime) return { status: "rejected", reason: "stale_identity" };
        const action = runtime.description.actions.find(
          (action) => action.actionId === operation.actionId,
        );
        if (!action) return { status: "rejected", reason: "invalid_action" };
        if (action.target.kind !== "participant")
          return { status: "rejected", reason: "invalid_action_lane" };
        let resolved: ReturnType<typeof runtime.binding.evaluator.resolve>;
        try {
          resolved = runtime.binding.evaluator.resolve(
            operation.actionId,
            operation.input,
            runtime.binding.gameId,
          );
        } catch {
          return { status: "rejected", reason: "invalid_action" };
        }
        const store = runtime.selected.find(
          (item) => item.domain === resolved.target.storeDomain,
        )?.store;
        if (!store || resolved.target.actionName.startsWith("_"))
          return { status: "rejected", reason: "invalid_action" };
        return {
          kind: "action",
          result: store.dispatchParticipant({
            controllerId,
            actionName: resolved.target.actionName,
            payload: resolved.payload,
          }),
        };
      },
    });
    entry.participants.set(roomId, participant);
  }
  return participant;
}

export function isHostRuntimeParticipantLeased(
  target: object,
  roomId: string,
  controllerId: string,
) {
  return (
    controls.get(target)?.participants.get(roomId)?.owns(controllerId) ?? false
  );
}

export function clearHostRuntimeParticipant(
  target: object,
  roomId: string,
  controllerId: string,
) {
  controls.get(target)?.participants.get(roomId)?.clearController(controllerId);
}

export function applyHostRuntimeLeasedControl(
  target: object,
  payload: ControllerLeasedControl,
): ControllerLeasedControlAck {
  if (!controls.get(target)?.receivers.has(payload.roomId))
    return { status: "rejected", reason: "unsupported" };
  const participant = participantControl(target, payload.roomId);
  return (
    participant?.apply(payload) ?? { status: "rejected", reason: "unsupported" }
  );
}

/** Register one live host store; cleanup cannot remove another binding. */
export const registerHostRuntimeActionStore = (
  target: object,
  binding: ActionStore,
): (() => void) => {
  const entry = controlEntry(target);
  const key = storeKey(binding.roomId, binding.storeDomain);
  const stores = entry.stores.get(key) ?? new Set<ActionStore>();
  const registration = { ...binding };
  stores.add(registration);
  entry.stores.set(key, stores);
  Reflect.set(target, AIR_JAM_RUNTIME_CONTROL_KEY, entry.control);
  notifyHostRuntimeChanged(target, binding.roomId);
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    stores.delete(registration);
    if (!stores.size) entry.stores.delete(key);
    notifyHostRuntimeChanged(target, binding.roomId);
    discardUnusedEntry(target, entry);
  };
};

export function registerHostAgentContract(
  target: object,
  binding: { roomId: string; gameId: string; contract: AnyAirJamAgentContract },
) {
  const entry = controlEntry(target);
  const registration = {
    id: nanoid(),
    roomId: binding.roomId,
    gameId: binding.gameId,
    evaluator: createAirJamAgentEvaluator(binding.contract),
  };
  entry.contracts.add(registration);
  Reflect.set(target, AIR_JAM_RUNTIME_CONTROL_KEY, entry.control);
  notifyHostRuntimeChanged(target, binding.roomId);
  return () => {
    if (!entry.contracts.delete(registration)) return;
    notifyHostRuntimeChanged(target, binding.roomId);
    discardUnusedEntry(target, entry);
  };
}
