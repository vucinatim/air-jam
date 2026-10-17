import { describe, expect, it, vi } from "vitest";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  hostRuntimeDocumentId,
  readHostStateEpochs,
  registerHostRuntimeActionStore,
  subscribeHostStateOwners,
  type HostRuntimeControl,
} from "../src/runtime/contracts/control";

const request = { roomId: "ROOM1", storeDomain: "game", actionName: "start" };
const accepted = { ok: true, status: "accepted", source: "host" } as const;
const readControl = (target: object): HostRuntimeControl =>
  Reflect.get(target, AIR_JAM_RUNTIME_CONTROL_KEY);

describe("owned browser host action control", () => {
  it("observes latest per-domain owners without granting control and survives binding cleanup", () => {
    const target = {};
    const documentId = hostRuntimeDocumentId(target);
    const changes: unknown[] = [];
    const unsubscribe = subscribeHostStateOwners(target, () =>
      changes.push(readHostStateEpochs(target, request.roomId)),
    );
    expect(readControl(target)).toBeUndefined();
    const invoke = vi.fn().mockResolvedValue(accepted);
    const first = registerHostRuntimeActionStore(target, {
      ...request,
      invoke,
      dispatchParticipant: vi.fn(),
      contractStoreDomain: "default",
      read: () => ({ data: {}, revision: 0 }),
      stateEpoch: "first",
    });
    const replacement = registerHostRuntimeActionStore(target, {
      ...request,
      invoke,
      dispatchParticipant: vi.fn(),
      contractStoreDomain: "default",
      read: () => ({ data: {}, revision: 0 }),
      stateEpoch: "replacement",
    });
    expect(readHostStateEpochs(target, request.roomId)).toEqual([
      { storeDomain: "game", epoch: "replacement" },
    ]);
    first();
    expect(readHostStateEpochs(target, request.roomId)).toEqual([
      { storeDomain: "game", epoch: "replacement" },
    ]);
    replacement();
    expect(readControl(target)).toBeUndefined();
    expect(hostRuntimeDocumentId(target)).toBe(documentId);
    const rebound = registerHostRuntimeActionStore(target, {
      ...request,
      invoke,
      dispatchParticipant: vi.fn(),
      contractStoreDomain: "default",
      read: () => ({ data: {}, revision: 0 }),
      stateEpoch: "replacement",
    });
    expect(changes.at(-1)).toEqual([
      { storeDomain: "game", epoch: "replacement" },
    ]);
    expect(readHostStateEpochs(target, "OTHER")).toEqual([]);
    rebound();
    unsubscribe();
    expect(hostRuntimeDocumentId(target)).toBe(documentId);
    expect(hostRuntimeDocumentId({})).not.toBe(documentId);
    expect(changes).toHaveLength(6);
  });
  it("routes exact room/domain and cleans up by binding identity", async () => {
    const target = {};
    const invoke = vi.fn().mockResolvedValue(accepted);
    const close = registerHostRuntimeActionStore(target, {
      ...request,
      invoke,
      dispatchParticipant: vi.fn(),
      contractStoreDomain: "default",
      read: () => ({ data: {}, revision: 0 }),
      stateEpoch: "fixture-epoch",
    });
    const control = readControl(target);
    expect(await control.invoke(request)).toEqual(accepted);
    expect(invoke).toHaveBeenCalledWith(request);
    expect(await control.invoke({ ...request, roomId: "OTHER" })).toMatchObject(
      { reason: "host_store_unavailable" },
    );
    expect(
      await control.invoke({ ...request, storeDomain: "shell" }),
    ).toMatchObject({ reason: "host_store_unavailable" });
    close();
    expect(readControl(target)).toBeUndefined();
    const newer = registerHostRuntimeActionStore(target, {
      ...request,
      invoke,
      dispatchParticipant: vi.fn(),
      contractStoreDomain: "default",
      read: () => ({ data: {}, revision: 0 }),
      stateEpoch: "fixture-epoch",
    });
    close();
    expect(await readControl(target).invoke(request)).toEqual(accepted);
    expect(await control.invoke(request)).toMatchObject({
      reason: "host_store_unavailable",
    });
    newer();
  });

  it("refuses ambiguous host stores without replacing either owner", async () => {
    const target = {};
    const invoke = vi.fn().mockResolvedValue(accepted);
    const closeFirst = registerHostRuntimeActionStore(target, {
      ...request,
      invoke,
      dispatchParticipant: vi.fn(),
      contractStoreDomain: "default",
      read: () => ({ data: {}, revision: 0 }),
      stateEpoch: "fixture-epoch",
    });
    const closeSecond = registerHostRuntimeActionStore(target, {
      ...request,
      invoke,
      dispatchParticipant: vi.fn(),
      contractStoreDomain: "default",
      read: () => ({ data: {}, revision: 0 }),
      stateEpoch: "fixture-epoch",
    });
    expect(await readControl(target).invoke(request)).toMatchObject({
      reason: "host_store_ambiguous",
    });
    expect(invoke).not.toHaveBeenCalled();
    closeFirst();
    expect(await readControl(target).invoke(request)).toEqual(accepted);
    closeFirst();
    expect(await readControl(target).invoke(request)).toEqual(accepted);
    closeSecond();
  });

  it("rejects reserved, malformed and unserializable calls before dispatch", async () => {
    const target = {};
    const invoke = vi.fn().mockResolvedValue(accepted);
    const close = registerHostRuntimeActionStore(target, {
      ...request,
      invoke,
      dispatchParticipant: vi.fn(),
      contractStoreDomain: "default",
      read: () => ({ data: {}, revision: 0 }),
      stateEpoch: "fixture-epoch",
    });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const invalid of [
      { ...request, actionName: "_internal" },
      { ...request, payload: { fn: () => undefined } },
      { ...request, payload: cyclic },
      { ...request, payload: { number: Infinity } },
      { ...request, actionName: "" },
      { ...request, actor: { role: "host" } },
    ]) {
      expect(await readControl(target).invoke(invalid)).toMatchObject({
        reason: "invalid_host_action",
      });
    }
    expect(invoke).not.toHaveBeenCalled();
    close();
  });
});
