export const VISUAL_HARNESS_BRIDGE_KEY = '__airJamVisualHarness';
export const VISUAL_HARNESS_ACTIONS_KEY = '__airJamVisualHarnessActions';

export type VisualHarnessBridgeSnapshot = {
  roomId: string | null;
  controllerJoinUrl: string | null;
  matchPhase: string | null;
  runtimeState: string | null;
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
  typeof value === 'object' && value !== null;

export const readVisualHarnessBridgeSnapshot = (
  target: unknown = globalThis,
): VisualHarnessBridgeSnapshot | null => {
  if (!isRecord(target)) {
    return null;
  }

  const raw = target[VISUAL_HARNESS_BRIDGE_KEY];
  if (!isRecord(raw)) {
    return null;
  }

  return {
    roomId: typeof raw.roomId === 'string' ? raw.roomId : null,
    controllerJoinUrl:
      typeof raw.controllerJoinUrl === 'string' ? raw.controllerJoinUrl : null,
    matchPhase: typeof raw.matchPhase === 'string' ? raw.matchPhase : null,
    runtimeState: typeof raw.runtimeState === 'string' ? raw.runtimeState : null,
    updatedAt:
      typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
};

export const publishVisualHarnessBridgeSnapshot = (
  snapshot: Omit<VisualHarnessBridgeSnapshot, 'updatedAt'>,
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

export const publishVisualHarnessBridgeActions = (
  actions: VisualHarnessBridgeActions,
  target: unknown = globalThis,
): void => {
  if (!isRecord(target)) {
    return;
  }

  target[VISUAL_HARNESS_ACTIONS_KEY] = actions;
};
