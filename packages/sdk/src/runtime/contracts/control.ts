import { z } from "zod";
import { roomCodeSchema } from "../../protocol/core";
import type { AirJamActionInvocationResult } from "../../protocol/sync";
import { isRpcSerializable } from "../../utils/is-rpc-serializable";

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
  invoke(
    request: HostRuntimeActionRequest,
  ): Promise<AirJamActionInvocationResult>;
}

type ActionStore = {
  invoke: (
    request: HostRuntimeActionRequest,
  ) => Promise<AirJamActionInvocationResult>;
};

const controls = new WeakMap<
  object,
  {
    stores: Map<string, Set<ActionStore>>;
    control: HostRuntimeControl;
  }
>();

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

/** Register one live host store; cleanup cannot remove another binding. */
export const registerHostRuntimeActionStore = (
  target: object,
  binding: ActionStore & { roomId: string; storeDomain: string },
): (() => void) => {
  let entry = controls.get(target);
  if (!entry) {
    const stores = new Map<string, Set<ActionStore>>();
    const control: HostRuntimeControl = {
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
    entry = { stores, control };
    controls.set(target, entry);
    Reflect.set(target, AIR_JAM_RUNTIME_CONTROL_KEY, control);
  }
  const key = storeKey(binding.roomId, binding.storeDomain);
  const stores = entry.stores.get(key) ?? new Set<ActionStore>();
  const registration = { invoke: binding.invoke };
  stores.add(registration);
  entry.stores.set(key, stores);
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    stores.delete(registration);
    if (!stores.size) entry.stores.delete(key);
    if (!entry.stores.size) {
      if (Reflect.get(target, AIR_JAM_RUNTIME_CONTROL_KEY) === entry.control) {
        Reflect.deleteProperty(target, AIR_JAM_RUNTIME_CONTROL_KEY);
      }
      if (controls.get(target) === entry) controls.delete(target);
    }
  };
};
