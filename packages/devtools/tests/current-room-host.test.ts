import type {
  HostAgentRequest,
  HostObservation,
} from "@air-jam/sdk/runtime-control";
import { randomUUID } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import { afterEach, expect, it } from "vitest";
import { currentRoomHost } from "../src/current-room-host.js";
import { currentRoomAttachmentSchema } from "../src/game-run-protocol.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanups.splice(0)) await close();
});
const request: Extract<HostAgentRequest, { operation: "observe" }> = {
  operation: "observe",
  roomId: "ROOM",
  controllerId: "agent",
  scope: "player",
  includeImage: false,
};
function observation(): HostObservation {
  return {
    version: 1,
    id: randomUUID(),
    identity: {
      roomId: "ROOM",
      documentId: "document",
      contractId: "contract",
      runtimeId: "runtime",
      surfaceId: "surface",
      participantId: "receiver",
    },
    sequence: 1,
    scope: "player",
    controllerId: "agent",
    capturedAt: new Date().toISOString(),
    durationMs: 0,
    snapshot: { score: 1 },
    runtime: null,
    ticks: { before: 1, after: 1 },
    stores: { before: [], after: [] },
    visual: { status: "unavailable", reason: "not-requested" },
  };
}
async function fixture(reply: (response: ServerResponse) => void) {
  const messages: unknown[] = [];
  const server = createServer(async (incoming, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    messages.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    reply(response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected TCP fixture.");
  const attachment = currentRoomAttachmentSchema.parse({
    controllerJoinUrl:
      "http://localhost/controller?room=ROOM&aj_controller_cap=private-room-secret",
    controllerIds: ["agent"],
    host: {
      endpoint: `http://127.0.0.1:${address.port}/private-target`,
      targetId: "target-secret",
    },
  });
  const ownerInstanceId = randomUUID();
  return {
    read: currentRoomHost(attachment, ownerInstanceId),
    messages,
    attachment,
    ownerInstanceId,
  };
}
it("uses the standard host agent protocol and binds the original broker owner", async () => {
  const frame = observation();
  const f = await fixture((response) =>
    response.end(
      JSON.stringify({
        ok: true,
        response: { operation: "observe", observation: frame },
      }),
    ),
  );
  expect(await f.read(request, 5000)).toEqual({
    operation: "observe",
    observation: frame,
  });
  expect(f.messages).toEqual([
    { targetId: "target-secret", ownerInstanceId: f.ownerInstanceId, request },
  ]);
  expect(JSON.stringify(f.messages)).not.toContain("private-room-secret");
});
it.each(["room", "player", "scope", "generation"])(
  "rejects a response for another %s",
  async (field) => {
    const frame = observation();
    if (field === "room") frame.identity.roomId = "ELSE";
    if (field === "player") frame.controllerId = "human";
    if (field === "scope") frame.scope = "diagnostic";
    const expected = { ...observation().identity };
    if (field === "generation") frame.identity.documentId = "replacement";
    const f = await fixture((response) =>
      response.end(
        JSON.stringify({
          ok: true,
          response: { operation: "observe", observation: frame },
        }),
      ),
    );
    await expect(f.read({ ...request, expected }, 5000)).rejects.toThrow(
      "runtime_replaced",
    );
  },
);
it.each([401, 403, 409, 500])(
  "never includes endpoint or server secrets in an HTTP %s error",
  async (status) => {
    const f = await fixture((response) => {
      response.statusCode = status;
      response.end("private-room-secret target-secret");
    });
    try {
      await f.read(request, 5000);
      throw new Error("Expected rejection");
    } catch (error) {
      expect(String(error)).not.toMatch(
        /private-room-secret|target-secret|private-target/,
      );
      expect(String(error)).toMatch(
        status === 500 ? /current_host_unavailable/ : /runtime_replaced/,
      );
    }
  },
);
it("rejects redirects and oversized observations", async () => {
  const redirect = await fixture((response) => {
    response.writeHead(302, { location: "http://127.0.0.1/secret" });
    response.end();
  });
  await expect(redirect.read(request, 5000)).rejects.toThrow(
    "current_host_unavailable",
  );
  const large = await fixture((response) =>
    response.end("x".repeat(2 * 1024 * 1024 + 1)),
  );
  await expect(large.read(request, 5000)).rejects.toThrow("current_host_limit");
});
it("reports the host's own refusal and rejects an answer to another request", async () => {
  const refused = await fixture((response) =>
    response.end(
      JSON.stringify({
        ok: false,
        error: "contract_changed: Read the current contract first.",
      }),
    ),
  );
  await expect(refused.read(request, 5000)).rejects.toThrow("contract_changed");
  const other = await fixture((response) =>
    response.end(
      JSON.stringify({
        ok: true,
        response: { operation: "read", snapshot: null },
      }),
    ),
  );
  await expect(other.read(request, 5000)).rejects.toThrow(
    "current_host_invalid",
  );
});

it.each([401, 403, 409])(
  "passes the editor's HTTP %s refusal cause through",
  async (status) => {
    const message =
      "The test lost the creator's room. The game reloaded in the creator's editor.";
    const f = await fixture((response) => {
      response.statusCode = status;
      response.end(JSON.stringify({ error: message }));
    });
    await expect(f.read(request, 5000)).rejects.toThrow(
      `runtime_replaced: ${message}`,
    );
  },
);
it.each([
  "",
  "{}",
  '{"error":null}',
  '{"error":"  "}',
  "not json",
  "x".repeat(4097),
])("falls back for an absent or invalid refusal cause (%#)", async (body) => {
  const f = await fixture((response) => {
    response.statusCode = 403;
    response.end(body);
  });
  await expect(f.read(request, 5000)).rejects.toThrow(
    "runtime_replaced: The creator's room is no longer granted.",
  );
});
it("bounds the editor's refusal text", async () => {
  const f = await fixture((response) => {
    response.statusCode = 409;
    response.end(JSON.stringify({ error: "a".repeat(500) }));
  });
  await expect(f.read(request, 5000)).rejects.toThrow(
    new Error(`runtime_replaced: ${"a".repeat(300)}`),
  );
});
