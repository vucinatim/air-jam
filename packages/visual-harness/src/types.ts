import type { Page } from '@playwright/test';
import type {
  AnyVisualHarnessBridgeDefinition,
  InferVisualHarnessBridgeActions,
  InferVisualHarnessBridgeSnapshot,
  VisualHarnessActionInvokerMap,
} from './bridge-contract.js';

export type VisualHarnessMode = 'standalone-dev' | 'arcade-built';

export type VisualViewport = {
  width: number;
  height: number;
};

export type VisualScreenshotRecord = {
  surface: 'host' | 'controller';
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
  getByLabel: Page['getByLabel'];
  getByRole: Page['getByRole'];
  getByTestId: Page['getByTestId'];
  getByText: Page['getByText'];
  locator: Page['locator'];
};

export type VisualHarnessPageSurface = {
  page: Page;
  game: VisualQuerySurface;
  embedded: boolean;
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
  actions: VisualHarnessActionInvokerMap<InferVisualHarnessBridgeActions<TBridge>>;
};

export type VisualScenarioContext<
  TBridge extends AnyVisualHarnessBridgeDefinition = AnyVisualHarnessBridgeDefinition,
> = {
  gameId: string;
  scenario: VisualScenario<TBridge>;
  scenarioDir: string;
  urls: VisualHarnessUrls;
  host: VisualHarnessPageSurface;
  controller: VisualHarnessPageSurface & {
    fullscreenPromptDismissed: boolean;
  };
  note: (value: string) => void;
  sleep: (ms: number) => Promise<void>;
  ensureControllerInteractive: () => Promise<void>;
  bridge: VisualScenarioBridge<TBridge>;
  captureHost: (viewportName: string, viewport: VisualViewport) => Promise<void>;
  captureController: (viewportName: string, viewport: VisualViewport) => Promise<void>;
  screenshotRecords: VisualScreenshotRecord[];
  notes: string[];
  close: () => Promise<void>;
};

export type VisualScenario<
  TBridge extends AnyVisualHarnessBridgeDefinition = AnyVisualHarnessBridgeDefinition,
> = {
  id: string;
  description?: string;
  run: (context: VisualScenarioContext<TBridge>) => Promise<void>;
};

export type VisualScenarioPack<
  TBridge extends AnyVisualHarnessBridgeDefinition = AnyVisualHarnessBridgeDefinition,
> = {
  gameId: string;
  bridge: TBridge;
  scenarios: ReadonlyArray<VisualScenario<TBridge>>;
};

export type VisualCaptureScenarioMetadata = {
  gameId: string;
  scenarioId: string;
  scenarioDescription: string | null;
  runtimeMode: VisualHarnessMode;
  capturedAt: string;
  status: 'captured' | 'failed';
  urls: Omit<VisualHarnessUrls, 'controllerJoinUrl'> | VisualHarnessUrls;
  screenshots: Array<{
    surface: 'host' | 'controller';
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
    status: 'captured' | 'failed';
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
