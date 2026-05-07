import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage } from "node:http";
import { isAuthorized, parseBearerToken } from "./access-control";

const createRequest = (
  authorization: string | string[] | undefined,
): IncomingMessage =>
  ({
    headers: {
      authorization,
    },
  }) as IncomingMessage;

test("parseBearerToken accepts case-insensitive bearer tokens", () => {
  assert.equal(parseBearerToken("Bearer abc123"), "abc123");
  assert.equal(parseBearerToken("bearer xyz"), "xyz");
});

test("parseBearerToken rejects missing or malformed values", () => {
  assert.equal(parseBearerToken(undefined), null);
  assert.equal(parseBearerToken(["Bearer abc123"]), null);
  assert.equal(parseBearerToken("Basic abc123"), null);
  assert.equal(parseBearerToken("Bearer"), null);
});

test("isAuthorized allows all requests when access token is unset", () => {
  assert.equal(
    isAuthorized({
      request: createRequest(undefined),
      accessToken: null,
    }),
    true,
  );
});

test("isAuthorized requires a matching bearer token when configured", () => {
  assert.equal(
    isAuthorized({
      request: createRequest("Bearer preview-token"),
      accessToken: "preview-token",
    }),
    true,
  );

  assert.equal(
    isAuthorized({
      request: createRequest("Bearer wrong-token"),
      accessToken: "preview-token",
    }),
    false,
  );
});
