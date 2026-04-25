import {
  describeVisualHarnessActions,
  launchHarnessBrowser,
  openVisualHarnessHostSession,
  type VisualHarnessMode,
} from "@air-jam/harness";
import { loadVisualScenarioPackFromModuleOrConfig } from "./visual-pack.js";

const getFlagValue = (flag: string): string | null => {
  const inline = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (inline) {
    return inline.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
};

const parseJsonFlag = (flag: string): unknown => {
  const value = getFlagValue(flag);
  return value ? JSON.parse(value) : undefined;
};

const operation = getFlagValue("--operation");
const modulePath = getFlagValue("--module-path");
const configPath = getFlagValue("--config");
const hostUrl = getFlagValue("--host-url");
const appOrigin = getFlagValue("--app-origin");
const controllerBaseUrl = getFlagValue("--controller-base-url");
const publicHost = getFlagValue("--public-host");
const localBuildUrl = getFlagValue("--local-build-url");
const browserBuildUrl = getFlagValue("--browser-build-url");
const requestedMode = getFlagValue("--mode") ?? "standalone-dev";
const requestedRoomId = getFlagValue("--room-id")?.trim().toUpperCase() ?? null;
const actionName = getFlagValue("--action-name");
const timeoutMs = Number(getFlagValue("--timeout-ms") ?? "10000");
const payload = parseJsonFlag("--payload-json");

const readRoomIdFromJoinUrl = (
  value: string | null | undefined,
): string | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    const roomId = parsed.searchParams.get("room")?.trim().toUpperCase();
    return roomId || null;
  } catch {
    return null;
  }
};

if (
  !operation ||
  (!modulePath && !configPath) ||
  !hostUrl ||
  !appOrigin ||
  !controllerBaseUrl ||
  !publicHost
) {
  throw new Error(
    "Missing required harness session inputs. Expected operation, module path, and resolved topology URLs.",
  );
}

if (operation !== "read" && operation !== "invoke") {
  throw new Error(`Unsupported harness session operation "${operation}".`);
}

if (operation === "invoke" && !actionName) {
  throw new Error("Missing required --action-name for harness invocation.");
}

const scenarioPack = await loadVisualScenarioPackFromModuleOrConfig({
  modulePath,
  configPath,
});
const availableActions = Object.keys(scenarioPack.bridge.actions ?? {});
const actionMetadata = describeVisualHarnessActions(
  scenarioPack.bridge.actions ?? {},
);
if (actionName && !availableActions.includes(actionName)) {
  throw new Error(
    `Unknown harness action "${actionName}" for "${scenarioPack.gameId}". Available actions: ${availableActions.join(", ") || "(none)"}`,
  );
}

const browser = await launchHarnessBrowser();

try {
  const session = await openVisualHarnessHostSession({
    browser,
    mode: requestedMode as VisualHarnessMode,
    urls: {
      appOrigin,
      hostUrl,
      controllerBaseUrl,
      publicHost,
      localBuildUrl,
      browserBuildUrl,
    },
  });

  try {
    const snapshot = await session.waitForBridgeSnapshot(
      (value) => value !== null,
      "harness bridge snapshot",
      timeoutMs,
    );

    if (operation === "read") {
      process.stdout.write(
        `${JSON.stringify(
          {
            gameId: scenarioPack.gameId,
            actions: actionMetadata,
            availableActions,
            roomId:
              readRoomIdFromJoinUrl(snapshot?.controllerJoinUrl) ??
              requestedRoomId,
            controllerJoinUrl: snapshot?.controllerJoinUrl ?? null,
            snapshot,
          },
          null,
          2,
        )}\n`,
      );
    } else {
      const result = await session.invokeBridgeAction(actionName!, payload);
      const snapshotAfter = await session.readBridgeSnapshot();
      process.stdout.write(
        `${JSON.stringify(
          {
            gameId: scenarioPack.gameId,
            actions: actionMetadata,
            availableActions,
            roomId:
              readRoomIdFromJoinUrl(
                snapshotAfter?.controllerJoinUrl ?? snapshot?.controllerJoinUrl,
              ) ?? requestedRoomId,
            controllerJoinUrl:
              snapshotAfter?.controllerJoinUrl ??
              snapshot?.controllerJoinUrl ??
              null,
            actionName,
            payload,
            result,
            snapshotBefore: snapshot,
            snapshotAfter,
          },
          null,
          2,
        )}\n`,
      );
    }
  } finally {
    await session.close();
  }
} finally {
  await browser.close();
}
