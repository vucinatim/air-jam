import {
  AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY,
  type ResolvedAirJamRuntimeTopology,
} from "@air-jam/sdk/runtime-topology";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type LaunchOptions,
} from "playwright-core";

import {
  admitProcessScopeMember,
  processScopeToken,
} from "../../process-scope-admission.js";
import { processScopeMarker } from "../../process-scope.js";

/** Production assets receive their owner-provided topology before the app loads, only in their own origin. */
export async function installHarnessRuntimeTopology(
  context: BrowserContext,
  topology: ResolvedAirJamRuntimeTopology,
) {
  await context.addInitScript(
    ({ key, topology }) => {
      if (window.location.origin === topology.appOrigin)
        (window as unknown as Record<string, unknown>)[key] = topology;
    },
    { key: AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY, topology },
  );
}

const launchHarnessBrowserOptions = () => {
  return {
    headless: true,
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-angle=swiftshader",
    ],
  };
};
const launchConfiguredBrowser = async <Result>(
  launch: (options: LaunchOptions) => Promise<Result>,
): Promise<Result> => {
  const options = launchHarnessBrowserOptions();

  if (process.env.AIRJAM_BROWSER_EXECUTABLE_PATH) {
    return launch({
      ...options,
      executablePath: process.env.AIRJAM_BROWSER_EXECUTABLE_PATH,
    });
  }

  try {
    return await launch(options);
  } catch (bundledBrowserError) {
    try {
      return await launch({ ...options, channel: "chrome" });
    } catch (systemBrowserError) {
      throw new Error(
        [
          "Air Jam could not launch a browser runtime for semantic sessions.",
          "Install Playwright Chromium or set AIRJAM_BROWSER_EXECUTABLE_PATH to a Chromium-compatible browser.",
          `Bundled browser: ${bundledBrowserError instanceof Error ? bundledBrowserError.message : String(bundledBrowserError)}`,
          `System Chrome: ${systemBrowserError instanceof Error ? systemBrowserError.message : String(systemBrowserError)}`,
        ].join("\n\n"),
      );
    }
  }
};

export const launchHarnessBrowser = (): Promise<Browser> =>
  launchConfiguredBrowser((options) => chromium.launch(options));

export async function launchScopedHarnessBrowser() {
  const marker = processScopeMarker(processScopeToken());
  const server = await launchConfiguredBrowser((options) =>
    chromium.launchServer({
      ...options,
      args: [...(options.args ?? []), marker],
    }),
  );
  try {
    const processId = server.process().pid;
    if (!processId)
      throw new Error(
        "process_scope_unavailable: Browser process identity unavailable.",
      );
    await admitProcessScopeMember(processId);
    const browser = await chromium.connect(server.wsEndpoint());
    return { browser, close: () => server.close() };
  } catch (error) {
    await server.close();
    throw error;
  }
}
