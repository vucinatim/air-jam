import type { VisualHarnessMode, VisualViewport } from "./types.js";

export type PrefabCaptureVariants = Readonly<Record<string, string>>;

export type PrefabCaptureRequest = {
  prefabId: string;
  variants: PrefabCaptureVariants;
  mode: VisualHarnessMode;
};

export type PrefabCaptureDefinition = {
  id: string;
  prefabId: string;
  description?: string;
  viewport?: VisualViewport;
  waitForTestId?: string;
  buildHostUrl: (hostUrl: string, request: PrefabCaptureRequest) => string;
};

export type PrefabCaptureHarness = {
  gameId: string;
  prefabs: readonly PrefabCaptureDefinition[];
};

export const definePrefabCaptureHarness = <
  const THarness extends PrefabCaptureHarness,
>(
  harness: THarness,
): THarness => harness;
