import {
  launchHarnessBrowser,
  openVisualHarnessHostSession,
  type VisualHarnessMode,
} from "@air-jam/harness";

const getFlagValue = (flag: string): string | null => {
  const inline = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (inline) {
    return inline.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
};

const appOrigin = getFlagValue("--app-origin");
const hostUrl = getFlagValue("--host-url");
const controllerBaseUrl = getFlagValue("--controller-base-url");
const publicHost = getFlagValue("--public-host");
const localBuildUrl = getFlagValue("--local-build-url");
const browserBuildUrl = getFlagValue("--browser-build-url");
const roomId = getFlagValue("--room-id");
const requestedMode = getFlagValue("--mode") ?? "standalone-dev";
const timeoutMs = Number(getFlagValue("--timeout-ms") ?? "15000");

if (!appOrigin || !hostUrl || !controllerBaseUrl || !publicHost) {
  throw new Error(
    "Missing required isolated harness host inputs. Expected resolved topology URLs.",
  );
}

const resolvedAppOrigin = appOrigin;
const resolvedControllerBaseUrl = controllerBaseUrl;
const resolvedPublicHost = publicHost;
const resolvedBaseHostUrl = hostUrl;
const resolvedHostUrl = (() => {
  if (!roomId) {
    return resolvedBaseHostUrl;
  }

  const nextUrl = new URL(resolvedBaseHostUrl);
  nextUrl.searchParams.set("room", roomId);
  return nextUrl.toString();
})();

const browser = await launchHarnessBrowser();
const session = await openVisualHarnessHostSession({
  browser,
  mode: requestedMode as VisualHarnessMode,
  urls: {
    appOrigin: resolvedAppOrigin,
    hostUrl: resolvedHostUrl,
    controllerBaseUrl: resolvedControllerBaseUrl,
    publicHost: resolvedPublicHost,
    localBuildUrl,
    browserBuildUrl,
  },
});

const shutdown = async (exitCode = 0) => {
  await Promise.allSettled([session.close(), browser.close()]);
  process.exit(exitCode);
};

process.on("SIGTERM", () => {
  void shutdown(0);
});

process.on("SIGINT", () => {
  void shutdown(0);
});

try {
  const snapshot = await session.waitForBridgeSnapshot(
    (value) => value !== null && value.controllerJoinUrl !== null,
    "isolated harness controller join URL",
    timeoutMs,
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        roomId: snapshot.roomId,
        controllerJoinUrl: snapshot.controllerJoinUrl,
        snapshot,
      },
      null,
      2,
    )}\n`,
  );

  await new Promise(() => {
    // Keep the hidden host runtime alive until the parent process disconnects it.
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  await shutdown(1);
}
