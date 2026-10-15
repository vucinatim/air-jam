import { describe, expect, it } from "vitest";
import { agentActionInput } from "../src/agent/agent-action";
import {
  agentAction,
  defineAirJamAgentContract,
} from "../src/agent/agent-contract";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  registerHostAgentContract,
  registerHostRuntimeActionStore,
  type HostRuntimeControl,
} from "../src/runtime/contracts/control";

function fixture(domain = "default") {
  const target = {};
  let score = 0;
  let revision = 0;
  const contract = defineAirJamAgentContract({
    stores: { default: {} },
    projectSnapshot: ({
      stores,
      controllerId,
    }): Record<string, unknown> | Promise<Record<string, unknown>> => ({
      score: (stores.default as { score: number }).score,
      controllerId,
    }),
    actions: {
      score: agentAction.participant(
        { actionName: "score" },
        {
          input: agentActionInput.number(),
          toPayload: (value) => ({ score: value }),
        },
      ),
      finish: agentAction.host(
        { actionName: "finish" },
        { input: agentActionInput.none() },
      ),
    },
  });
  const mount = () =>
    registerHostRuntimeActionStore(target, {
      roomId: "ROOM",
      storeDomain: domain,
      contractStoreDomain: "default",
      stateEpoch: String(Math.random()),
      read: () => ({ data: { score }, revision }),
      invoke: async () => {
        score = 10;
        revision++;
        return { ok: true, status: "accepted", source: "host" };
      },
    });
  const closeStore = mount();
  const bind = () =>
    registerHostAgentContract(target, {
      roomId: "ROOM",
      gameId: "test",
      contract,
    });
  const close = bind();
  const control = () =>
    Reflect.get(target, AIR_JAM_RUNTIME_CONTROL_KEY) as HostRuntimeControl;
  const read = async () => {
    const result = await control().agent({
      operation: "read",
      roomId: "ROOM",
      controllerId: "player",
    });
    if (result.operation !== "read" || !result.snapshot)
      throw Error("missing snapshot");
    return result.snapshot;
  };
  return { target, contract, bind, close, control, read, mount, closeStore };
}

describe("live contract evaluation", () => {
  it("reads authoritative state, maps the embedded default domain and resolves both action lanes", async () => {
    const f = fixture("aj.embedded.game:7:pong");
    const before = await f.read();
    expect(before.snapshot).toEqual({ score: 0, controllerId: "player" });
    expect(before.storeDomainBindings).toEqual([
      {
        contractStoreDomain: "default",
        runtimeStoreDomain: "aj.embedded.game:7:pong",
      },
    ]);
    const base = {
      roomId: "ROOM",
      controllerId: "player",
      contractId: before.contractId,
      runtimeId: before.runtimeId,
      operation: "resolve" as const,
    };
    expect(
      await f.control().agent({ ...base, actionId: "score", payload: 3 }),
    ).toMatchObject({
      target: { kind: "participant", storeDomain: "aj.embedded.game:7:pong" },
      payload: { score: 3 },
    });
    expect((await f.read()).snapshot.score).toBe(0);
    expect(
      await f
        .control()
        .agent({ ...base, operation: "invoke-host", actionId: "finish" }),
    ).toMatchObject({ acknowledgement: { status: "accepted" } });
    expect((await f.read()).snapshot.score).toBe(10);
    f.close();
    f.closeStore();
    expect(Reflect.get(f.target, AIR_JAM_RUNTIME_CONTROL_KEY)).toBeUndefined();
  });
  it("rejects ambiguity and stale contract or store instances without executing actions", async () => {
    const f = fixture();
    const before = await f.read();
    const duplicate = f.bind();
    await expect(f.read()).rejects.toThrow("contract_runtime_ambiguous");
    duplicate();
    f.close();
    const closeReplacement = f.bind();
    const after = await f.read();
    expect(after.contractId).not.toBe(before.contractId);
    const request = {
      operation: "resolve" as const,
      roomId: "ROOM",
      controllerId: "player",
      contractId: before.contractId,
      runtimeId: before.runtimeId,
      actionId: "finish",
    };
    await expect(f.control().agent(request)).rejects.toThrow(
      "contract_changed",
    );
    f.closeStore();
    const newStore = f.mount();
    await expect(
      f.control().agent({ ...request, contractId: after.contractId }),
    ).rejects.toThrow("runtime_replaced");
    expect((await f.read()).snapshot.score).toBe(0);
    newStore();
    closeReplacement();
  });
  it("rejects non-JSON projections and payloads, preserves game errors and checks identity after async projection", async () => {
    const f = fixture();
    f.contract.projectSnapshot = async () => ({ bad: () => 0 });
    await expect(f.read()).rejects.toThrow("serializable JSON");
    f.contract.projectSnapshot = async () => {
      throw Error("authored projection failed");
    };
    await expect(f.read()).rejects.toThrow("authored projection failed");
    f.contract.projectSnapshot = async () => {
      f.close();
      return { score: 0 };
    };
    await expect(f.read()).rejects.toThrow("contract_changed");
    f.closeStore();
  });
  it("can clean up and re-register like a StrictMode mount without old cleanup deleting the new owner", async () => {
    const f = fixture();
    f.close();
    const clean = f.bind();
    f.close();
    expect(await f.read()).toMatchObject({ snapshot: { score: 0 } });
    clean();
    f.closeStore();
  });
});
