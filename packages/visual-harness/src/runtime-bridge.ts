export const VISUAL_HARNESS_BRIDGE_KEY = "__airJamVisualHarness";
export const VISUAL_HARNESS_ACTIONS_KEY = "__airJamVisualHarnessActions";
export const VISUAL_HARNESS_ENABLE_PARAM = "aj_visual_harness";
export const VISUAL_HARNESS_ENABLE_VALUE = "enabled";

export type VisualHarnessBridgeSnapshot = Record<string, unknown> & {
  roomId: string | null;
  controllerJoinUrl: string | null;
  matchPhase: string | null;
  runtimeState: string | null;
};

export type PublishedVisualHarnessBridgeSnapshot =
  VisualHarnessBridgeSnapshot & {
    updatedAt: string;
  };

export type VisualHarnessBridgeActionHandler = (
  payload?: unknown,
) => unknown | Promise<unknown>;

export type VisualHarnessBridgeActions = Record<
  string,
  VisualHarnessBridgeActionHandler
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const readVisualHarnessBridgeSnapshot = <
  TSnapshot extends VisualHarnessBridgeSnapshot = VisualHarnessBridgeSnapshot,
>(
  target: unknown = globalThis,
): TSnapshot | null => {
  if (!isRecord(target)) {
    return null;
  }

  const raw = target[VISUAL_HARNESS_BRIDGE_KEY];
  if (!isRecord(raw)) {
    return null;
  }

  return {
    ...raw,
    roomId: typeof raw.roomId === "string" ? raw.roomId : null,
    controllerJoinUrl:
      typeof raw.controllerJoinUrl === "string" ? raw.controllerJoinUrl : null,
    matchPhase: typeof raw.matchPhase === "string" ? raw.matchPhase : null,
    runtimeState:
      typeof raw.runtimeState === "string" ? raw.runtimeState : null,
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  } as unknown as TSnapshot;
};

export const publishVisualHarnessBridgeSnapshot = (
  snapshot: VisualHarnessBridgeSnapshot,
  target: unknown = globalThis,
): void => {
  if (!isRecord(target)) {
    return;
  }

  target[VISUAL_HARNESS_BRIDGE_KEY] = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };
};

export const clearVisualHarnessBridgeSnapshot = (
  target: unknown = globalThis,
): void => {
  if (!isRecord(target)) {
    return;
  }

  delete target[VISUAL_HARNESS_BRIDGE_KEY];
};

export const publishVisualHarnessBridgeActions = (
  actions: VisualHarnessBridgeActions,
  target: unknown = globalThis,
): void => {
  if (!isRecord(target)) {
    return;
  }

  target[VISUAL_HARNESS_ACTIONS_KEY] = actions;
};

export const clearVisualHarnessBridgeActions = (
  target: unknown = globalThis,
): void => {
  if (!isRecord(target)) {
    return;
  }

  delete target[VISUAL_HARNESS_ACTIONS_KEY];
};
