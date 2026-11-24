// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { expect, it } from "vitest";
import { createConnectionStore } from "../src/core/connection-store";
import {
  createAirJamStore,
  type AirJamStoreRequest,
  type AirJamStoreRoom,
} from "../src/core/replicated-store";
import type { StateDocument } from "../src/room-protocol";
import { declaredStoresContext } from "../src/runtime/runtime-owner-contexts";
import { useAirJamStore } from "../src/store/use-air-jam-store";

it("keeps an open phone live across host hot updates, including its actions", async () => {
  const makeStore = () =>
    createAirJamStore<{ phase: string; actions: { play: () => void } }>(
      (set) => ({
        phase: "lobby",
        actions: { play: () => set({ phase: "playing" }) },
      }),
    );
  // One room between whichever host store is current and the open phone.
  let answer: ((request: AirJamStoreRequest) => unknown) | null = null;
  const phoneListeners = new Set<(document: StateDocument) => void>();
  let copy: StateDocument | undefined;
  const phoneRoom: AirJamStoreRoom = {
    role: "controller",
    document: () => copy,
    onDocument: (_channel, listener) => {
      phoneListeners.add(listener);
      return () => phoneListeners.delete(listener);
    },
    request: async (_channel, name, payload) =>
      answer
        ? { status: "answered", result: answer({ seat: "p1", name, payload }) }
        : { status: "refused", reason: "host-away" },
  };
  const hostRoom: AirJamStoreRoom = {
    role: "host",
    publish: (_channel, document) => {
      copy = document;
      for (const listener of phoneListeners) listener(document);
    },
    onRestore: () => () => {},
    answer: (_channel, handler) => {
      answer = handler;
      return () => {
        if (answer === handler) answer = null;
      };
    },
  };
  const connection = (role: "host" | "controller") => {
    const store = createConnectionStore();
    store.setState({
      role,
      roomId: "ROOM1",
      controllerId: role === "controller" ? "p1" : null,
      players: [
        {
          id: "p1",
          label: "Player 1",
          color: "#fff",
          kind: "phone",
          connected: true,
        },
      ],
    });
    return store;
  };
  const phone = makeStore();
  const detachPhone = phone.attach({
    room: phoneRoom,
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
        detachHost = host.attach({
          room: hostRoom,
          connection: connection("host"),
          defaultStoreDomain: "default",
          controlTarget: null,
          now: () => 0,
        });
      });
      expect(screen.getByRole("button").textContent).toBe("lobby");
      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });
      expect(host.getState().phase).toBe("playing");
      expect(screen.getByRole("button").textContent).toBe("playing");
      act(() => host.api.setState({ phase: "ended" }));
      expect(screen.getByRole("button").textContent).toBe("ended");
    }
  } finally {
    view.unmount();
    detachHost();
    detachPhone();
    expect(answer).toBeNull();
    expect(phoneListeners.size).toBe(0);
  }
});
