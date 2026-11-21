import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { drawAgentCanvas } from "../agent/capture-canvas";
import {
  createHostCanvasCapture,
  type HostCanvasDraw,
} from "../agent/host-canvas-capture";
import type { HostObservationCapture } from "../core/host-runtime";
import { hostCaptureContext } from "./host-capture-context";
import {
  stageCaptureCanvasSelector,
  type StageCaptureCanvas,
} from "./stage-capture";

/** One recording canvas follows game rendering or the native visible stage. */
export function HostCaptureBoundary({
  children,
  setObservationCapture,
}: {
  children: ReactNode;
  setObservationCapture: (capture: HostObservationCapture | null) => void;
}) {
  const draw = useRef<HostCanvasDraw | null>(null);
  const usingStage = useRef(false);
  const binding = useRef<ReturnType<typeof createHostCanvasCapture> | null>(
    null,
  );
  const owner = useMemo(
    () => ({
      setDraw: (value: HostCanvasDraw | null) => {
        draw.current = value;
      },
      rendered: () => {
        if (!usingStage.current || !binding.current?.recording())
          binding.current?.rendered();
      },
    }),
    [],
  );
  useLayoutEffect(() => {
    const captureBinding = createHostCanvasCapture((target, options) => {
      if (!usingStage.current || !captureBinding.recording())
        usingStage.current = !draw.current?.(target, options);
      if (!usingStage.current) return true;
      const stage = document.querySelector<StageCaptureCanvas>(
        stageCaptureCanvasSelector,
      );
      stage?.requestPaint();
      return drawAgentCanvas(stage, target, options);
    });
    binding.current = captureBinding;
    const capture: HostObservationCapture = (options) => {
      const image = captureBinding.capture(options);
      const coverage = usingStage.current ? "host-document" : "render-surface";
      return Promise.resolve(image).then(
        (value) => value && { ...value, coverage },
      );
    };
    capture.startVideo = captureBinding.capture.startVideo;
    setObservationCapture(capture);
    return () => {
      setObservationCapture(null);
      captureBinding.dispose();
      binding.current = null;
    };
  }, [setObservationCapture]);
  // Subscribe after the stage's mount ref so its pixels are drawn first.
  useEffect(() => {
    const stage = document.querySelector<StageCaptureCanvas>(
      stageCaptureCanvasSelector,
    );
    if (!stage) return;
    const painted = () => {
      if (!usingStage.current || !binding.current?.recording()) return;
      binding.current.rendered();
      if (usingStage.current && binding.current.recording())
        stage.requestPaint();
    };
    stage.addEventListener("paint", painted);
    return () => stage.removeEventListener("paint", painted);
  }, []);
  return (
    <hostCaptureContext.Provider value={owner}>
      {children}
    </hostCaptureContext.Provider>
  );
}
