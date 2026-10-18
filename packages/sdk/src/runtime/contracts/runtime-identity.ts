import { z } from "zod";
import { roomCodeSchema } from "../../protocol/core";

export const hostRuntimeIdentitySchema = z.object({
  documentId: z.string().min(1).max(128),
  roomId: roomCodeSchema,
  contractId: z.string().min(1),
  runtimeId: z.string().min(1),
});
export type HostRuntimeIdentity = z.infer<typeof hostRuntimeIdentitySchema>;

export const hostObservationIdentitySchema = hostRuntimeIdentitySchema.extend({
  surfaceId: z.string().min(1).nullable(),
  participantId: z.string().min(1).nullable().default(null),
});
export type HostObservationIdentity = z.infer<
  typeof hostObservationIdentitySchema
>;
const identityKeys = hostObservationIdentitySchema.keyof().options;
export function sameHostRuntimeIdentity(
  first: HostObservationIdentity,
  second: HostObservationIdentity,
) {
  return identityKeys.every((key) => first[key] === second[key]);
}

const listeners = new WeakMap<object, Set<(roomId: string) => void>>();
export function subscribeHostRuntimeChanges(
  target: object,
  listener: (roomId: string) => void,
) {
  const current = listeners.get(target) ?? new Set<(roomId: string) => void>();
  current.add(listener);
  listeners.set(target, current);
  return () => {
    current.delete(listener);
    if (!current.size && listeners.get(target) === current)
      listeners.delete(target);
  };
}
export function notifyHostRuntimeChanged(target: object, roomId: string) {
  for (const listener of listeners.get(target) ?? []) listener(roomId);
}
