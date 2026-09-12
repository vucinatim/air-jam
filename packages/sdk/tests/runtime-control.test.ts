import { describe, expect, it, vi } from "vitest";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  registerHostRuntimeActionStore,
  type HostRuntimeControl,
} from "../src/runtime/contracts/control";

const request = { roomId: "ROOM1", storeDomain: "game", actionName: "start" };
const accepted = { ok: true, status: "accepted", source: "host" } as const;
const readControl = (target: object): HostRuntimeControl =>
  Reflect.get(target, AIR_JAM_RUNTIME_CONTROL_KEY);

describe("owned browser host action control", () => {
  it("routes exact room/domain and cleans up by binding identity", async () => {
    const target = {};
    const invoke = vi.fn().mockResolvedValue(accepted);
    const close = registerHostRuntimeActionStore(target, {
      ...request,
      invoke,
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
    });
    const closeSecond = registerHostRuntimeActionStore(target, {
      ...request,
      invoke,
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
