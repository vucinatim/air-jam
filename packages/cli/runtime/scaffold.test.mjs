import { resolveScaffoldHostedEnvironment } from "@air-jam/cli/scaffold";
import assert from "node:assert/strict";
import test from "node:test";

test("a prerelease scaffolder builds games against beta, a release against production", () => {
  assert.equal(
    resolveScaffoldHostedEnvironment("1.0.0-beta.4").platformOrigin,
    "https://beta.airjam.io",
  );
  assert.equal(
    resolveScaffoldHostedEnvironment("1.0.0").platformOrigin,
    "https://airjam.io",
  );
});
