import { expect, it } from "vitest";
import { hostRuntimeFaultSchema } from "../src/runtime/contracts/observation";
import { hostRuntimeFault } from "../src/runtime/host-runtime-fault";

it.each([
  "TypeError: bad at bogus.ts:9:1\n    at sdk (http://localhost/packages/sdk/dist/core.js:1:2)\n    at draw (http://localhost/src/arena.ts?t=1:42:7)",
  "draw@http://localhost/src/arena.ts:42:7\nframe@http://localhost/node_modules/vendor.js:1:2",
])("finds the first game frame across browser stack formats (%#)", (stack) => {
  const error = new TypeError("bad");
  error.stack = stack;
  expect(hostRuntimeFault(error).source).toEqual({
    file: "src/arena.ts",
    line: 42,
    column: 7,
  });
});
it("keeps unknown locations null and bounds serializable exception details", () => {
  expect(hostRuntimeFault("oops")).toEqual({
    name: "Error",
    message: "oops",
    source: null,
    stack: "",
  });
  const error = new Error("x".repeat(3000));
  error.name = "N".repeat(200);
  error.stack =
    "Error\n    at sdk (http://localhost/node_modules/@air-jam/sdk/core.js:1:2)\n" +
    "x".repeat(9000);
  const fault = hostRuntimeFault(error);
  expect(hostRuntimeFaultSchema.parse(fault)).toEqual(fault);
  expect(fault.source).toBeNull();
  expect(fault.name).toHaveLength(128);
  expect(fault.message).toHaveLength(2048);
  expect(fault.stack).toHaveLength(8192);
  expect(
    hostRuntimeFaultSchema.safeParse({ ...fault, stack: "x".repeat(8193) })
      .success,
  ).toBe(false);
});
