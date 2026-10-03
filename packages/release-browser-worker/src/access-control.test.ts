import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import test from "node:test";
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
  for (const value of [
    undefined,
    ["Bearer abc123"],
    ["Bearer abc123", "Bearer other"],
    "Basic abc123",
    "Bearer",
    "Bearer abc123 extra",
    "Bearer abc123, Bearer other",
    " Bearer abc123",
    "Bearer abc123 ",
    "Bearer  abc123",
    "Bearer\tabc123",
    "Bearer abc123\n",
    "Bearer abc123\u007f",
    "Bearer abc123é",
  ])
    assert.equal(parseBearerToken(value), null);
});

test("isAuthorized fails closed even if invalid runtime configuration bypasses the env loader", () => {
  for (const accessToken of [null, undefined, ""]) {
    assert.equal(
      isAuthorized({
        request: createRequest(undefined),
        accessToken: accessToken as unknown as string,
      }),
      false,
    );
    assert.equal(
      isAuthorized({
        request: createRequest("Bearer anything"),
        accessToken: accessToken as unknown as string,
      }),
      false,
    );
  }
});

test("isAuthorized requires a matching bearer token when configured", () => {
  assert.equal(
    isAuthorized({
      request: createRequest("Bearer unit-test-browser-token-0123456789abcdef"),
      accessToken: "unit-test-browser-token-0123456789abcdef",
    }),
    true,
  );

  assert.equal(
    isAuthorized({
      request: createRequest("Bearer wrong-token"),
      accessToken: "unit-test-browser-token-0123456789abcdef",
    }),
    false,
  );
});

test("isAuthorized rejects same-length mismatches and malformed authorization", () => {
  const token = "unit-test-browser-token-0123456789abcdef";
  for (const header of [
    undefined,
    `Bearer ${token.slice(0, -1)}x`,
    `Bearer ${token} extra`,
    [`Bearer ${token}`],
    `Bearer ${token.slice(1)}`,
    `Bearer ${token}x`,
  ])
    assert.equal(
      isAuthorized({ request: createRequest(header), accessToken: token }),
      false,
    );
});
