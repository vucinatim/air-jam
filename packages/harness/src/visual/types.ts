import type { AirJamAgentContract, AnyAirJamAgentContract } from "@air-jam/sdk";
import type { Page } from "@playwright/test";
import type {
  AnyVisualHarnessBridgeDefinition,
  InferVisualHarnessBridgeActions,
  InferVisualHarnessBridgeSnapshot,
  VisualHarnessActionInvokerMap,
} from "../core/bridge-contract.js";

export type { AnyAirJamAgentContract } from "@air-jam/sdk";

export type VisualHarnessMode = "standalone-dev" | "arcade-built";

export type VisualViewport = {
  width: number;
  height: number;
};

export type VisualScreenshotRecord = {
  surface: "host" | "controller";
  viewportName: string;
  width: number;
  height: number;
  fileName: string;
  filePath: string;
};

export type VisualHarnessUrls = {
  appOrigin: string;
  hostUrl: string;
  controllerBaseUrl: string;
  publicHost: string;
  localBuildUrl: string | null;
  browserBuildUrl: string | null;
  controllerJoinUrl: string;
};

export type VisualQuerySurface = {
  getByLabel: Page["getByLabel"];
  getByRole: Page["getByRole"];
  getByTestId: Page["getByTestId"];
  getByText: Page["getByText"];
  locator: Page["locator"];
};

export type VisualHarnessPageSurface = {
  page: Page;
  game: VisualQuerySurface;
  embedded: boolean;
};

export type InferVisualScenarioSnapshot<TAgent> =
  TAgent extends AirJamAgentContract<infer TSnapshot, infer _TStores>
    ? TSnapshot
    : never;

export type VisualScenarioAgentActionDescriptor = {
  actionId: string;
  lane: "player" | "host";
  source: "semantic-game" | "visual-harness";
  description: string | null;
  availability: string | null;
  payload: {
    kind: "none" | "boolean" | "number" | "string" | "enum" | "json";
    description: string | null;
    allowedValues?: string[];
  };
  resultDescription: string | null;
};

export type VisualScenarioAgentInvocation<TSnapshot = Record<string, unknown>> =
  {
    actionId: string;
    lane: "player" | "host";
    outcome: string | null;
    acknowledgementObservation: string | null;
    snapshotBefore: TSnapshot | null;
    snapshotAfter: TSnapshot | null;
    snapshotAfterStatus:
      | "committed-update-observed"
      | "no-new-commit-before-timeout"
      | null;
  };

export type VisualScenarioAgent<TSnapshot = Record<string, unknown>> = {
  listActions: () => Promise<readonly VisualScenarioAgentActionDescriptor[]>;
  read: () => Promise<TSnapshot>;
  waitFor: (
    predicate: (snapshot: TSnapshot) => boolean | Promise<boolean>,
    description?: string,
    timeout?: number,
  ) => Promise<TSnapshot>;
  invoke: (
    actionId: string,
    payload?: unknown,
    options?: {
      timeoutMs?: number;
    },
  ) => Promise<VisualScenarioAgentInvocation<TSnapshot>>;
  close: () => Promise<void>;
};

export type VisualScenarioBridge<
  TBridge extends AnyVisualHarnessBridgeDefinition,
> = {
  read: () => Promise<InferVisualHarnessBridgeSnapshot<TBridge> | null>;
  waitFor: (
    predicate: (
      snapshot: InferVisualHarnessBridgeSnapshot<TBridge> | null,
    ) => boolean | Promise<boolean>,
    description?: string,
    timeout?: number,
  ) => Promise<InferVisualHarnessBridgeSnapshot<TBridge>>;
  actions: VisualHarnessActionInvokerMap<
    InferVisualHarnessBridgeActions<TBridge>
  >;
};

export type VisualScenarioContext<
  TAgent extends AnyAirJamAgentContract = AnyAirJamAgentContract,
  TBridge extends AnyVisualHarnessBridgeDefinition | null =
    AnyVisualHarnessBridgeDefinition | null,
> = {
  gameId: string;
  scenario: VisualScenario<TAgent, TBridge>;
  scenarioDir: string;
  urls: VisualHarnessUrls;
  host: VisualHarnessPageSurface;
  controller: VisualHarnessPageSurface & {
    fullscreenPromptDismissed: boolean;
  };
  note: (value: string) => void;
  sleep: (ms: number) => Promise<void>;
  ensureControllerInteractive: () => Promise<void>;
  agent: VisualScenarioAgent<InferVisualScenarioSnapshot<TAgent>>;
  bridge: TBridge extends AnyVisualHarnessBridgeDefinition
    ? VisualScenarioBridge<TBridge>
    : null;
  captureHost: (
    viewportName: string,
    viewport: VisualViewport,
  ) => Promise<void>;
  captureController: (
    viewportName: string,
    viewport: VisualViewport,
  ) => Promise<void>;
  screenshotRecords: VisualScreenshotRecord[];
  notes: string[];
  close: () => Promise<void>;
};

export type VisualScenario<
  TAgent extends AnyAirJamAgentContract = AnyAirJamAgentContract,
  TBridge extends AnyVisualHarnessBridgeDefinition | null =
    AnyVisualHarnessBridgeDefinition | null,
> = {
  id: string;
  description?: string;
  run: (context: VisualScenarioContext<TAgent, TBridge>) => Promise<void>;
};

export type VisualScenarioPack<
  TAgent extends AnyAirJamAgentContract = AnyAirJamAgentContract,
  TBridge extends AnyVisualHarnessBridgeDefinition | null =
    AnyVisualHarnessBridgeDefinition | null,
> = {
  agent: TAgent;
  bridge?: TBridge;
  scenarios: ReadonlyArray<VisualScenario<TAgent, TBridge>>;
};

export type VisualCaptureScenarioMetadata = {
  gameId: string;
  scenarioId: string;
  scenarioDescription: string | null;
  runtimeMode: VisualHarnessMode;
  capturedAt: string;
  status: "captured" | "failed";
  urls: Omit<VisualHarnessUrls, "controllerJoinUrl"> | VisualHarnessUrls;
  screenshots: Array<{
    surface: "host" | "controller";
    viewportName: string;
    width: number;
    height: number;
    fileName: string;
    relativePath: string;
  }>;
  notes: string[];
  error: {
    message: string;
    stack: string | null;
  } | null;
};

export type VisualCaptureSummary = {
  gameId: string;
  mode: VisualHarnessMode;
  secure: boolean;
  capturedAt: string;
  scenarios: Array<{
    scenarioId: string;
    status: "captured" | "failed";
    screenshotCount: number;
    relativeDir: string;
  }>;
};

export type RunVisualCaptureCommandOptions = {
  gameId: string;
  scenarioId?: string | null;
  mode?: VisualHarnessMode;
  secure?: boolean;
};
