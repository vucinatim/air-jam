import { createAirJamStore, type AirJamActionContext } from "../src/index";

interface ValidNetworkedStore {
  phase: "lobby" | "playing";
  actions: {
    startMatch: (ctx: AirJamActionContext, payload: undefined) => void;
    joinTeam: (
      ctx: AirJamActionContext,
      payload: { team: "red" | "blue" },
    ) => void;
  };
}

createAirJamStore<ValidNetworkedStore>((set) => ({
  phase: "lobby",
  actions: {
    startMatch: () => set({ phase: "playing" }),
    joinTeam: (_ctx, _payload) => set({ phase: "playing" }),
  },
}));

interface InvalidPrimitivePayloadStore {
  phase: "lobby" | "playing";
  actions: {
    setPhase: (ctx: AirJamActionContext, payload: string) => void;
  };
}

// @ts-expect-error networked actions must use zero args or one plain-object payload
createAirJamStore<InvalidPrimitivePayloadStore>((set) => ({
  phase: "lobby",
  actions: {
    setPhase: (_ctx: AirJamActionContext, payload: string) =>
      set({ phase: payload as "lobby" | "playing" }),
  },
}));

interface InvalidArrayPayloadStore {
  phase: "lobby" | "playing";
  actions: {
    setPhase: (
      ctx: AirJamActionContext,
      payload: Array<"lobby" | "playing">,
    ) => void;
  };
}

// @ts-expect-error networked actions must not use array payload roots
createAirJamStore<InvalidArrayPayloadStore>((set) => ({
  phase: "lobby",
  actions: {
    setPhase: (
      _ctx: AirJamActionContext,
      payload: Array<"lobby" | "playing">,
    ) => set({ phase: payload[0] ?? "lobby" }),
  },
}));
