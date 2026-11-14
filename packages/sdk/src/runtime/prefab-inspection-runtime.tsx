import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { flushSync } from "react-dom";
import type { AirJamProviderProps } from "../context/air-jam-context";
import type { HostObservationCapture } from "../core/host-runtime";
import {
  prefabMetadata,
  type PrefabCatalog,
  type PrefabState,
} from "../prefabs/types";
import { DEFAULT_PREFAB_VIEW } from "../prefabs/view";
import { resolveAirJamConfig } from "./air-jam-config";
import { AirJamErrorBoundary } from "./air-jam-error-boundary";
import { embeddedRuntimeParent } from "./embedded-parent";
import {
  prefabInspectionMessageSchema,
  prefabInspectionRequestSchema,
  type PrefabCapturedImage,
  type PrefabCaptureView,
  type PrefabInspectionMessage,
  type PrefabSelection,
} from "./prefab-inspection-bridge";
import { advancePrefabClock } from "./prefab-inspection-clock";
import {
  prefabInspectionCaptureContext,
  prefabInspectionContext,
} from "./prefab-inspection-context";

function InspectionStage({
  selection,
  prefab,
  state,
  stage: Stage,
}: {
  selection: PrefabSelection;
  prefab: PrefabCatalog[number];
  state: PrefabState;
  stage: ComponentType;
}) {
  return (
    <prefabInspectionContext.Provider
      value={{
        ...selection,
        prefab,
        props: prefab.configSchema.parse(prefab.defaultProps),
        state,
      }}
    >
      <Stage />
    </prefabInspectionContext.Provider>
  );
}
const NO_PREFABS: PrefabCatalog = [];
export function PrefabInspectionRuntime({
  prefabs = NO_PREFABS,
  prefabStage: Stage,
  ...config
}: Omit<AirJamProviderProps, "children"> & {
  prefabs?: PrefabCatalog;
  prefabStage?: ComponentType;
}) {
  const catalog = useMemo(() => prefabs.map(prefabMetadata), [prefabs]);
  const topology = resolveAirJamConfig(config).topology;
  const { embedded, embedParentOrigin } = topology;
  const parent = useMemo(
    () => embeddedRuntimeParent({ embedded, embedParentOrigin }),
    [embedded, embedParentOrigin],
  );
  const capture = useRef<HostObservationCapture | null>(null);
  const captureOwner = useMemo(
    () => ({
      setObservationCapture: (value: HostObservationCapture | null) => {
        capture.current = value;
      },
    }),
    [],
  );
  const [selection, setSelection] = useState<PrefabSelection | null>(() => {
    const query = new URLSearchParams(window.location.search);
    const prefab =
      catalog.find((item) => item.id === query.get("prefab")) ?? catalog[0];
    if (!prefab) return null;
    const state =
      prefab.states.find((item) => item.id === query.get("state")) ??
      prefab.states[0]!;
    const time = Number(query.get("time") ?? 0);
    return {
      prefabId: prefab.id,
      stateId: state.id,
      time:
        Number.isFinite(time) && time >= 0
          ? advancePrefabClock(time, 0, state).time
          : 0,
      playing: false,
      view: DEFAULT_PREFAB_VIEW,
    };
  });
  const current = useRef(selection);
  current.current = selection;
  const failure = useRef<string | null>(null);
  const report = useCallback(
    (message: PrefabInspectionMessage) =>
      parent?.window.postMessage(
        prefabInspectionMessageSchema.parse(message),
        parent.origin,
      ),
    [parent],
  );
  const unavailable = !catalog.length
    ? "This game declares no prefabs. Add prefabs: createPrefabCatalog([...]) to defineAirJamGame."
    : !Stage
      ? "This game has no prefab stage. Pass prefabStage={Stage} to app.Host."
      : null;
  const commit = useCallback(
    (next: PrefabSelection) => {
      const prefab = catalog.find((item) => item.id === next.prefabId);
      if (!prefab) throw new Error(`Unknown prefab: ${next.prefabId}`);
      const state = prefab.states.find((item) => item.id === next.stateId);
      if (!state) throw new Error(`Unknown state: ${next.stateId}`);
      const clock = advancePrefabClock(next.time, 0, state);
      const value = {
        ...next,
        time: clock.time,
        playing: next.playing && clock.playing,
      };
      flushSync(() => setSelection(value));
      current.current = value;
      report({ type: "AIRJAM_PREFAB_SELECTION", selection: value });
    },
    [catalog, report],
  );
  useEffect(() => {
    let closed = false;
    // Captures run one at a time. While one runs, a selection from the parent
    // becomes the view it returns to, so the creator's last choice wins.
    let queue = Promise.resolve();
    let restore: PrefabSelection | null = null;
    const publish = () => {
      if (failure.current)
        report({ type: "AIRJAM_PREFAB_ERROR", reason: failure.current });
      else if (unavailable)
        report({ type: "AIRJAM_PREFAB_UNAVAILABLE", reason: unavailable });
      else {
        report({ type: "AIRJAM_PREFAB_READY", catalog });
        if (current.current)
          report({
            type: "AIRJAM_PREFAB_SELECTION",
            selection: current.current,
          });
      }
    };
    const frames = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const captureViews = async (
      requestId: string,
      views: PrefabCaptureView[],
    ) => {
      try {
        if (unavailable) throw new Error(unavailable);
        if (failure.current) throw new Error(failure.current);
        const previous = current.current;
        if (!previous) throw new Error("Select a prefab before capture.");
        restore = previous;
        const images: PrefabCapturedImage[] = [];
        try {
          for (const view of views) {
            if (closed) return;
            commit({ ...previous, ...view, playing: false });
            await frames();
            if (closed) return;
            if (failure.current) throw new Error(failure.current);
            const image = await capture.current?.({
              maxEdge: 1280,
              quality: 0.85,
            });
            if (!image)
              throw new Error(
                "The prefab stage has no registered canvas. Use useHostAgentCapture.",
              );
            images.push({
              ...view,
              time: current.current!.time,
              imageUrl: `data:${image.mimeType};base64,${image.data}`,
              width: image.width,
              height: image.height,
            });
          }
        } finally {
          const next = restore;
          restore = null;
          if (!closed && next) commit(next);
        }
        if (!closed)
          report({ type: "AIRJAM_PREFAB_CAPTURED", requestId, images });
      } catch (error) {
        if (!closed)
          report({
            type: "AIRJAM_PREFAB_ERROR",
            requestId,
            reason: error instanceof Error ? error.message : String(error),
          });
      }
    };
    const listen = (event: MessageEvent<unknown>) => {
      if (
        !parent ||
        event.source !== parent.window ||
        event.origin !== parent.origin
      )
        return;
      const parsed = prefabInspectionRequestSchema.safeParse(event.data);
      if (!parsed.success) return;
      const message = parsed.data;
      if (message.type === "AIRJAM_PREFAB_READ") publish();
      else if (message.type === "AIRJAM_PREFAB_CAPTURE")
        queue = queue.then(() =>
          captureViews(message.requestId, message.views),
        );
      else if (restore) restore = message.selection;
      else {
        try {
          if (unavailable) throw new Error(unavailable);
          if (failure.current) throw new Error(failure.current);
          commit(message.selection);
        } catch (error) {
          report({
            type: "AIRJAM_PREFAB_ERROR",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };
    window.addEventListener("message", listen);
    publish();
    return () => {
      closed = true;
      window.removeEventListener("message", listen);
    };
  }, [parent, catalog, unavailable, report, commit]);
  useEffect(() => {
    if (!selection?.playing) return;
    let frame = 0;
    let last: number | null = null;
    let published = 0;
    const animate = (now: number) => {
      const value = current.current;
      if (!value?.playing) return;
      const state = catalog
        .find((item) => item.id === value.prefabId)
        ?.states.find((item) => item.id === value.stateId);
      if (!state) return;
      const next = {
        ...value,
        ...advancePrefabClock(
          value.time,
          last === null ? 0 : (now - last) / 1000,
          state,
        ),
      };
      last = now;
      current.current = next;
      setSelection(next);
      if (now - published >= 1000 / 15 || !next.playing) {
        report({ type: "AIRJAM_PREFAB_SELECTION", selection: next });
        published = now;
      }
      if (next.playing) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [selection?.playing, catalog, report]);
  const prefab = prefabs.find((item) => item.id === selection?.prefabId);
  const state = catalog
    .find((item) => item.id === selection?.prefabId)
    ?.states.find((item) => item.id === selection?.stateId);
  return (
    <AirJamErrorBoundary
      role="host"
      onError={(error) => {
        failure.current = error.message;
        report({ type: "AIRJAM_PREFAB_ERROR", reason: error.message });
      }}
    >
      <prefabInspectionCaptureContext.Provider value={captureOwner}>
        {unavailable ? (
          <p>{unavailable}</p>
        ) : prefab && state && selection && Stage ? (
          <InspectionStage
            selection={selection}
            prefab={prefab}
            state={state}
            stage={Stage}
          />
        ) : null}
      </prefabInspectionCaptureContext.Provider>
    </AirJamErrorBoundary>
  );
}
