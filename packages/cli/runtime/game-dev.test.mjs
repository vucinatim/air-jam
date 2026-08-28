import assert from "node:assert/strict";
import test from "node:test";
import { validateGameDevMode } from "./game-dev.mjs";
test("validateGameDevMode rejects preview-managed secure mode", () => {
  assert.throws(
    () =>
      validateGameDevMode({
        args: {
          secure: true,
          previewManaged: true,
          webOnly: false,
          serverOnly: false,
          allowExistingGame: false,
        },
      }),
    /Preview-managed mode does not support --secure/,
  );
});

test("validateGameDevMode keeps preview-managed local mode valid", () => {
  assert.doesNotThrow(() =>
    validateGameDevMode({
      args: {
        secure: false,
        previewManaged: true,
        webOnly: false,
        serverOnly: false,
        allowExistingGame: false,
      },
    }),
  );
});
