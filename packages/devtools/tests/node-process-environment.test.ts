import { expect, it } from "vitest";
import { nodeProcessEnvironment } from "../src/node-process-environment.js";

it("preserves the parent's Node runtime flag while sanitizing", () => {
  expect(
    nodeProcessEnvironment(["PATH"], {
      PATH: "/bin",
      ELECTRON_RUN_AS_NODE: "1",
      PRIVATE_TOKEN: "secret",
    }),
  ).toEqual({ PATH: "/bin", ELECTRON_RUN_AS_NODE: "1" });
  expect(nodeProcessEnvironment(["PATH"], { PATH: "/bin" })).toEqual({
    PATH: "/bin",
  });
});
