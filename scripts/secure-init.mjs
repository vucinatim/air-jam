#!/usr/bin/env node

import { runSecureInitCli } from "../packages/create-airjam/runtime/secure-dev.mjs";

await runSecureInitCli({
  nextStepMessage: "pnpm arcade:test -- --game=<id> --secure",
});
