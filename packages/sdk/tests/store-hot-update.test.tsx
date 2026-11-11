// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { expect, it } from "vitest";
import type { AirJamSocket } from "../src/context/socket-manager";
import { createConnectionStore } from "../src/core/connection-store";
import { createAirJamStore } from "../src/core/replicated-store";
import { getControllerRealtimeClient } from "../src/runtime/controller-realtime-client";
import { getHostRealtimeClient } from "../src/runtime/host-realtime-client";
import { declaredStoresContext } from "../src/runtime/runtime-owner-contexts";
import { useAirJamStore } from "../src/store/use-air-jam-store";
import { createMemorySocket } from "./fixtures/memory-socket";

it("keeps an open phone live across host hot updates, including its actions", async () => {
  const makeStore = () =>
    createAirJamStore<{ phase: string; actions: { play: () => void } }>(
      (set) => ({
        phase: "lobby",
        actions: { play: () => set({ phase: "playing" }) },
      }),
    );
  const phone = makeStore();
  const controllerSocket = createMemorySocket(() => undefined);
  controllerSocket.connect();
  let hostSocket = createMemorySocket(() => undefined);
  controllerSocket.emit.mockImplementation((event, ...args) => {
    if (event === "controller:state_sync_request") {
      hostSocket.fire("airjam:state_sync_request", args[0]);
    }
    if (event === "controller:action_rpc") {
      hostSocket.fire(
        "airjam:action_rpc",
        {
          ...(args[0] as object),
          actor: { id: "phone", role: "controller" },
        },
        args.at(-1),
      );
    }
    return controllerSocket;
  });
  const connection = (role: "host" | "controller") => {
    const store = createConnectionStore();
    store.setState({
      role,
      roomId: "ROOM1",
      registeredRoomId: "ROOM1",
      controllerId: "phone",
      connectionStatus: "connected",
      players: [{ id: "phone", label: "Player 1" }],
    });
    return store;
  };
  const detachPhone = phone.attach({
    socket: getControllerRealtimeClient(
      () => controllerSocket as unknown as AirJamSocket,
    ),
    connection: connection("controller"),
    defaultStoreDomain: "default",
    controlTarget: null,
    now: () => 0,
  });
  function Phone() {
    const { phase } = useAirJamStore(phone);
    return <button onClick={() => void phone.actions.play()}>{phase}</button>;
  }
  const view = render(
    createElement(
      declaredStoresContext.Provider,
      { value: new Set([phone]) },
      createElement(Phone),
    ),
  );
  let detachHost = () => {};
  try {
    for (let update = 0; update < 3; update += 1) {
      const host = makeStore();
      act(() => {
        detachHost();
        hostSocket = createMemorySocket(() => undefined);
        hostSocket.connect();
        hostSocket.emit.mockImplementation((event, ...args) => {
          if (event === "host:state_sync")
            controllerSocket.fire("airjam:state_sync", args[0]);
          return hostSocket;
        });
        detachHost = host.attach({
          socket: getHostRealtimeClient(
            () => hostSocket as unknown as AirJamSocket,
          ),
          connection: connection("host"),
          defaultStoreDomain: "default",
          controlTarget: null,
          now: () => 0,
        });
        controllerSocket.fire("server:roomReady", { roomId: "ROOM1" });
      });
      expect(screen.getByRole("button").textContent).toBe("lobby");
      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });
      expect(host.getState().phase).toBe("playing");
      expect(screen.getByRole("button").textContent).toBe("playing");
      act(() => host.api.setState({ phase: "ended" }));
      expect(screen.getByRole("button").textContent).toBe("ended");
      act(() => {
        controllerSocket.fire("server:roomReady", { roomId: "OTHER" });
        controllerSocket.fire("airjam:state_sync", {
          roomId: "ROOM1",
          storeDomain: "default",
          revision: 0,
          data: { phase: "old" },
        });
      });
      expect(screen.getByRole("button").textContent).toBe("ended");
    }
  } finally {
    view.unmount();
    detachHost();
    detachPhone();
    expect(controllerSocket.listenerCount()).toBe(0);
    expect(hostSocket.listenerCount()).toBe(0);
  }
});
