// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConnectionStore } from "../src/core/connection-store";
import {
  createAirJamStore,
  rejectAirJamAction,
  type AirJamActionContext,
  type AirJamStoreRequest,
  type AirJamStoreRoom,
} from "../src/core/replicated-store";
import {
  hostStateFrameSchema,
  type ChannelCopy,
  type SeatView,
  type StateDocument,
} from "../src/room-protocol";
import type { PublishOptions } from "../src/room-session/channel-state";
import type { RoomRequestOutcome } from "../src/room-session/phone-room-session";
import { declaredStoresContext } from "../src/runtime/runtime-owner-contexts";
import { useAirJamStore } from "../src/store/use-air-jam-store";

type Table = {
  phase: string;
  hands: Record<string, string>;
  lastActor?: string;
  actions: {
    deal: (ctx: AirJamActionContext, payload: { card: string }) => unknown;
    _secret: (ctx: AirJamActionContext, payload: undefined) => void;
  };
};
const createTable = () =>
  createAirJamStore<Table>(
    (set) => ({
      phase: "lobby",
      hands: {},
      actions: {
        deal: (ctx, { card }) => {
          if (card === "joker")
            return rejectAirJamAction("no_jokers", "Jokers are out.");
          set((state) => ({
            lastActor: ctx.actorId,
            hands: { ...state.hands, [ctx.actorId]: card },
          }));
          return undefined;
        },
        _secret: () => {},
      },
    }),
    { privateField: "hands" },
  );

const seat = (id: string, connected = true): SeatView => ({
  id,
  label: id,
  color: "#fff",
  kind: "phone",
  connected,
});

/** A host's view of the room: what the store publishes, and phones' requests on its channel. */
const hostRoom = () => {
  const published: Array<{ document: StateDocument; options: PublishOptions }> =
    [];
  const restorers = new Map<string, (copy: ChannelCopy) => void>();
  const answerers = new Map<string, (request: AirJamStoreRequest) => unknown>();
  const room: AirJamStoreRoom = {
    role: "host",
    publish: (_channel, document, options) => {
      published.push({ document, options });
    },
    onRestore: (channel, restore) => {
      restorers.set(channel, restore);
      return () => restorers.delete(channel);
    },
    answer: (channel, answer) => {
      answerers.set(channel, answer);
      return () => answerers.delete(channel);
    },
  };
  return {
    room,
    published,
    ask: (seatId: string, name: string, payload?: unknown) =>
      answerers.get("default")?.({ seat: seatId, name, payload }),
    restore: (copy: ChannelCopy) => restorers.get(copy.channel)?.(copy),
  };
};

/** A phone's view of the room: the copies it mirrors, and the answers its requests get. */
const phoneRoom = (outcome: RoomRequestOutcome) => {
  const listeners = new Set<(document: StateDocument) => void>();
  let current: StateDocument | undefined;
  const request = vi.fn(async () => outcome);
  const room: AirJamStoreRoom = {
    role: "controller",
    document: () => current,
    onDocument: (_channel, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    request,
  };
  return {
    room,
    request,
    push: (document: StateDocument) => {
      current = document;
      for (const listener of listeners) listener(document);
    },
  };
};

const attach = (
  store: ReturnType<typeof createTable>,
  room: AirJamStoreRoom,
  players: SeatView[] = [seat("p1"), seat("p2")],
) => {
  const connection = createConnectionStore();
  connection.setState({
    role: room.role,
    roomId: "ROOM1",
    controllerId: room.role === "controller" ? "p1" : null,
    players,
  });
  return store.attach({
    room,
    connection,
    defaultStoreDomain: "default",
    controlTarget: null,
    now: () => 42,
  });
};

const detachments: Array<() => void> = [];
afterEach(() => {
  for (const detach of detachments.splice(0)) detach();
});

describe("replicated stores", () => {
  it("publishes the host's state with its shape and private field, and runs a phone's action as that phone's seat", () => {
    const table = createTable();
    const host = hostRoom();
    const heard = vi.fn();
    table.subscribeHostActions(heard);
    detachments.push(attach(table, host.room));
    expect(host.published[0]).toEqual({
      document: { phase: "lobby", hands: {} },
      options: { fingerprint: expect.any(String), private: "hands" },
    });

    expect(host.ask("p2", "deal", { card: "ace" })).toEqual({
      ok: true,
      status: "accepted",
      source: "host",
    });
    expect(table.getState()).toMatchObject({
      lastActor: "p2",
      hands: { p2: "ace" },
    });
    expect(host.published.at(-1)?.document).toMatchObject({
      hands: { p2: "ace" },
    });
    expect(heard).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: "deal",
        invocationKind: "rpc",
        context: expect.objectContaining({ actorId: "p2", now: 42 }),
      }),
    );
  });

  it("fits a large store's shape fingerprint in a state frame, one per shape", () => {
    const fingerprintOf = (extra: string) => {
      const fields = Object.fromEntries(
        Array.from({ length: 80 }, (_, index) => [
          `${extra}field${index}`,
          { nested: [index], flag: true },
        ]),
      );
      const store = createAirJamStore<{
        fields: Record<string, { nested: number[]; flag: boolean }>;
        actions: {
          reset: (ctx: AirJamActionContext, payload: { to: number }) => void;
        };
      }>((set) => ({
        fields,
        actions: {
          reset: (_ctx, { to }) =>
            set({ fields: { reset: { nested: [to], flag: false } } }),
        },
      }));
      const host = hostRoom();
      detachments.push(
        store.attach({
          room: host.room,
          connection: createConnectionStore(),
          defaultStoreDomain: "default",
          controlTarget: null,
          now: () => 42,
        }),
      );
      return host.published[0]?.options.fingerprint;
    };
    const fingerprint = fingerprintOf("");
    expect(
      hostStateFrameSchema.safeParse({
        type: "state",
        channel: "default",
        revision: 1,
        document: {},
        fingerprint,
      }).success,
    ).toBe(true);
    expect(fingerprintOf("")).toBe(fingerprint);
    expect(fingerprintOf("other")).not.toBe(fingerprint);
  });

  it("refuses internal and unknown actions, and passes a handler's rejection back", () => {
    const table = createTable();
    const host = hostRoom();
    detachments.push(attach(table, host.room));
    expect(host.ask("p1", "_secret")).toMatchObject({
      status: "rejected",
      reason: "internal_action",
    });
    expect(host.ask("p1", "shuffle")).toMatchObject({
      status: "rejected",
      reason: "action_not_found",
    });
    expect(host.ask("p1", "deal", { card: "joker" })).toMatchObject({
      status: "rejected",
      reason: "no_jokers",
    });
  });

  it("takes the host's state back from the room only when the store's shape is the same", () => {
    const table = createTable();
    const host = hostRoom();
    detachments.push(attach(table, host.room));
    const fingerprint = (host.published[0]?.options as { fingerprint: string })
      .fingerprint;
    host.restore({
      channel: "default",
      revision: 3,
      document: { phase: "playing", hands: { p1: "king" } },
      fingerprint: "another shape",
    });
    expect(table.getState().phase).toBe("lobby");
    host.restore({
      channel: "default",
      revision: 3,
      document: { phase: "playing", hands: { p1: "king" } },
      fingerprint,
    });
    expect(table.getState()).toMatchObject({
      phase: "playing",
      hands: { p1: "king" },
    });
  });

  it("mirrors the room's copy on a phone, its own private entry included", () => {
    const table = createTable();
    const phone = phoneRoom({ status: "unconfirmed" });
    detachments.push(attach(table, phone.room));
    phone.push({ phase: "playing", hands: { p1: "queen" } });
    expect(table.getState()).toMatchObject({ phase: "playing" });
    expect(table.getPrivateState()).toBe("queen");
  });

  it("sends a phone's action as a request on its store's channel and reads its outcome", async () => {
    const table = createTable();
    const answered = phoneRoom({
      status: "answered",
      result: { ok: true, status: "accepted", source: "host" },
    });
    detachments.push(attach(table, answered.room));
    await expect(table.actions.deal({ card: "ace" })).resolves.toMatchObject({
      status: "accepted",
    });
    expect(answered.request).toHaveBeenCalledWith("default", "deal", {
      card: "ace",
    });
    detachments.splice(0).forEach((detach) => detach());

    detachments.push(attach(table, phoneRoom({ status: "unconfirmed" }).room));
    await expect(table.actions.deal({ card: "ace" })).resolves.toEqual({
      ok: false,
      status: "unconfirmed",
      source: "client",
    });
    detachments.splice(0).forEach((detach) => detach());

    detachments.push(
      attach(table, phoneRoom({ status: "refused", reason: "host-away" }).room),
    );
    await expect(table.actions.deal({ card: "ace" })).resolves.toMatchObject({
      status: "rejected",
      reason: "host_away",
    });
  });

  it("refuses payloads that are not plain serializable objects and drops event-like ones", async () => {
    const table = createTable();
    const phone = phoneRoom({
      status: "answered",
      result: { ok: true, status: "accepted", source: "host" },
    });
    detachments.push(attach(table, phone.room));
    const deal = table.actions.deal as (payload: unknown) => Promise<unknown>;
    await expect(deal({ card: () => "ace" })).resolves.toMatchObject({
      reason: "payload_not_serializable",
    });
    await expect(deal(["ace"])).resolves.toMatchObject({
      reason: "payload_invalid_shape",
    });
    await deal(new Event("click"));
    expect(phone.request).toHaveBeenLastCalledWith(
      "default",
      "deal",
      undefined,
    );
  });

  it("holds an action called before a runtime attaches the store until it does", async () => {
    const table = createTable();
    const host = hostRoom();
    const pending = table.actions.deal({ card: "ten" });
    detachments.push(attach(table, host.room));
    await expect(pending).resolves.toMatchObject({ status: "accepted" });
    expect(table.getState().hands).toEqual({ host: "ten" });
  });

  it("acts as a connected player only on the host", async () => {
    const table = createTable();
    const host = hostRoom();
    detachments.push(attach(table, host.room, [seat("p1"), seat("p2", false)]));
    await table.asPlayer("p1").deal({ card: "two" });
    expect(table.getState().hands).toMatchObject({ p1: "two" });
    await expect(
      table.asPlayer("p2").deal({ card: "three" }),
    ).resolves.toMatchObject({ reason: "player_not_connected" });
    detachments.splice(0).forEach((detach) => detach());

    detachments.push(attach(table, phoneRoom({ status: "unconfirmed" }).room));
    await expect(
      table.asPlayer("p1").deal({ card: "four" }),
    ).resolves.toMatchObject({ reason: "player_actions_host_only" });
  });

  it("refuses to render a store its runtime does not declare, and renders one it does", () => {
    const declared = createTable();
    const undeclared = createTable();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        declaredStoresContext.Provider,
        { value: new Set([declared]) },
        children,
      );
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      renderHook(() => useAirJamStore(undeclared), { wrapper }),
    ).toThrow(/defineAirJamGame\(\{ stores/);
    const { result } = renderHook(
      () => useAirJamStore(declared, (state) => state.phase),
      { wrapper },
    );
    expect(result.current).toBe("lobby");
  });
});
