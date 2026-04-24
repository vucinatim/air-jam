import path from "node:path";
import { parseArgs } from "node:util";
import { loadEnvFile } from "../../create-airjam/runtime/dev-utils.mjs";
import {
  DEFAULT_GAME_PORT,
  DEFAULT_PLATFORM_PORT,
  loadSecureDevState,
  SECURE_MODE_LOCAL,
} from "../../create-airjam/runtime/secure-dev.mjs";
import { startWorkspaceArcadeBuiltStack } from "./arcade-built-stack.mjs";
import { resolveRepoWorkspaceTopologySurfaces } from "./repo-workspace.mjs";
import {
  runWorkspaceArcadeDevCommand,
  runWorkspaceStandaloneDevCommand,
} from "./workspace-dev-commands.mjs";

const parseCli = () =>
  parseArgs({
    allowPositionals: true,
    options: {
      game: {
        type: "string",
      },
      mode: {
        type: "string",
      },
      secure: {
        type: "boolean",
        default: false,
      },
    },
  });

const writeTopology = async ({ rootDir, gameId, mode, secure }) => {
  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const secureState = secure
    ? loadSecureDevState({
        cwd: rootDir,
        mode: SECURE_MODE_LOCAL,
        env: process.env,
        gamePort: DEFAULT_GAME_PORT,
      })
    : null;

  const surfaces = resolveRepoWorkspaceTopologySurfaces({
    rootDir,
    gameId,
    mode,
    secure,
    secureState,
    gamePort: DEFAULT_GAME_PORT,
    platformPort: DEFAULT_PLATFORM_PORT,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        gameId,
        mode,
        secure,
        surfaces,
      },
      null,
      2,
    )}\n`,
  );
};

const run = async () => {
  const { positionals, values } = parseCli();
  const [command] = positionals;
  const rootDir = process.cwd();

  if (!command) {
    throw new Error(
      "Missing workspace runtime command. Use standalone-dev, arcade-dev, arcade-test, or topology.",
    );
  }

  if (!values.game) {
    throw new Error("Missing required --game option.");
  }

  if (command === "standalone-dev") {
    await runWorkspaceStandaloneDevCommand({
      rootDir,
      gameId: values.game,
      secure: values.secure,
    });
    return;
  }

  if (command === "arcade-dev") {
    await runWorkspaceArcadeDevCommand({
      rootDir,
      gameId: values.game,
      secure: values.secure,
    });
    return;
  }

  if (command === "arcade-test") {
    const stack = await startWorkspaceArcadeBuiltStack({
      rootDir,
      gameId: values.game,
      secure: values.secure,
    });

    console.log(
      `[arcade:test] Stable Arcade integration stack is ready for ${stack.activeGame.id}${values.secure ? " in secure local mode" : ""}.`,
    );

    await new Promise(() => {});
    return;
  }

  if (command === "topology") {
    const mode = values.mode;
    if (
      mode !== "standalone-dev" &&
      mode !== "arcade-live" &&
      mode !== "arcade-built"
    ) {
      throw new Error(
        'Missing or invalid --mode. Use "standalone-dev", "arcade-live", or "arcade-built".',
      );
    }

    await writeTopology({
      rootDir,
      gameId: values.game,
      mode,
      secure: values.secure,
    });
    return;
  }

  throw new Error(
    `Unknown workspace runtime command "${command}". Use standalone-dev, arcade-dev, arcade-test, or topology.`,
  );
};

await run();
