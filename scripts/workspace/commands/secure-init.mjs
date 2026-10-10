import { runSecureInitCli } from "../../../packages/cli/runtime/secure-dev.mjs";

export const runWorkspaceSecureInitCommand = async ({
  rootDir = process.cwd(),
  argv = [],
} = {}) =>
  runSecureInitCli({
    cwd: rootDir,
    argv,
    nextStepMessage: "pnpm run dev -- --game=<id> --secure",
  });
