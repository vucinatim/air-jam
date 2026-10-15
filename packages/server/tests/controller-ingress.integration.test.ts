import {
  CONTROLLER_INGRESS_KEY_HEADER,
  CONTROLLER_INGRESS_ROOM_HEADER,
} from "@air-jam/sdk/protocol";
import { describe, expect, it } from "vitest";
import { controllerIngressRoom } from "../src/policies/controller-ingress";
import { setupServerTestHarness } from "./helpers/server-test-harness";

const gatewayKey = "b".repeat(64);
const headers = (roomId: string) => ({
  [CONTROLLER_INGRESS_KEY_HEADER]: gatewayKey,
  [CONTROLLER_INGRESS_ROOM_HEADER]: roomId,
});

describe("controller ingress verification", () => {
  it("keeps ordinary private connections and rejects partial or invalid admission", () => {
    expect(controllerIngressRoom({}, gatewayKey)).toBeUndefined();
    expect(controllerIngressRoom(headers("ABCD"), gatewayKey)).toBe("ABCD");
    for (const request of [
      { [CONTROLLER_INGRESS_ROOM_HEADER]: "ABCD" },
      { [CONTROLLER_INGRESS_KEY_HEADER]: gatewayKey },
      { ...headers("ABCD"), [CONTROLLER_INGRESS_KEY_HEADER]: "a".repeat(64) },
      headers("../outside"),
    ])
      expect(() => controllerIngressRoom(request, gatewayKey)).toThrow();
    expect(() => controllerIngressRoom(headers("ABCD"), undefined)).toThrow();
  });
});

describe("room-scoped guest sockets", () => {
  const harness = setupServerTestHarness({
    server: { controllerGatewayKey: gatewayKey, devLogCollector: false },
  });

  it("admits play in one real room while refusing another room and host authority", async () => {
    const owner = await harness.connectSocket();
    expect((await harness.bootstrapHost(owner)).ok).toBe(true);
    const room = await harness.emitWithAck<{ ok: boolean; roomId: string }>(
      owner,
      "host:createRoom",
      { maxPlayers: 4 },
    );
    expect(room.ok).toBe(true);
    const guest = await harness.connectSocket({
      headers: headers(room.roomId),
    });
    const denied = await harness.emitWithAck<{ ok: boolean; code: string }>(
      guest,
      "controller:join",
      {
        roomId: room.roomId === "ABCD" ? "EFGH" : "ABCD",
        controllerId: "guest-phone",
      },
    );
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("UNAUTHORIZED");
    const joined = await harness.emitWithAck<{ ok: boolean; roomId: string }>(
      guest,
      "controller:join",
      { roomId: room.roomId, controllerId: "guest-phone" },
    );
    expect(joined.ok).toBe(true);
    expect(joined.roomId).toBe(room.roomId);
    await expect(harness.bootstrapHost(guest)).rejects.toThrow(
      "Timed out waiting for ack",
    );
    expect(
      harness.getRoomManager().getRoomByHostId(guest.id ?? ""),
    ).toBeUndefined();
    expect(harness.getRoomManager().getAllRooms().size).toBe(1);
  });

  it("rejects forged gateway credentials before admitting a socket", async () => {
    await expect(
      harness.connectSocket({
        headers: {
          ...headers("ABCD"),
          [CONTROLLER_INGRESS_KEY_HEADER]: "a".repeat(64),
        },
      }),
    ).rejects.toThrow();
  });

  it("binds polling sessions to their original controller admission on every request", async () => {
    const handshake = await fetch(
      `${harness.getBaseUrl()}/socket.io/?EIO=4&transport=polling`,
      { headers: headers("ABCD") },
    );
    expect(handshake.ok).toBe(true);
    const payload = JSON.parse((await handshake.text()).slice(1)) as {
      sid: string;
    };
    const url = `${harness.getBaseUrl()}/socket.io/?EIO=4&transport=polling&sid=${payload.sid}`;
    const changed = await fetch(url, {
      method: "POST",
      headers: { ...headers("EFGH"), "content-type": "text/plain" },
      body: "40",
    });
    expect(changed.ok).toBe(false);
    const stripped = await fetch(url, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "40",
    });
    expect(stripped.ok).toBe(false);
  });
});
