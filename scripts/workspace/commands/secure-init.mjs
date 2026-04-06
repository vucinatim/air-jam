import { runSecureInitCli } from "../../../packages/create-airjam/runtime/secure-dev.mjs";

export const runWorkspaceSecureInitCommand = async ({
  rootDir = process.cwd(),
  argv = [],
} = {}) =>
  runSecureInitCli({
    cwd: rootDir,
    argv,
    nextStepMessage:
      "pnpm arcade:dev --game=<id> --secure  # or pnpm standalone:dev --game=<id> --secure",
  });
