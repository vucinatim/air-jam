import { useCallback, useState, type ReactNode } from "react";
import {
  AIR_JAM_PREVIEW_CAPTURE_QUERY_PARAM,
  readPreviewControllerParent,
} from "../preview/identity";
import {
  supportsStageCapture,
  type StageCaptureCanvas,
} from "../runtime/stage-capture";

/** The choice is fixed at mount; real phones keep their original DOM tree. */
export function StageCaptureSurface({
  children,
  role,
}: {
  children: ReactNode;
  role: "host" | "controller";
}) {
  const [enabled] = useState(
    () =>
      typeof window !== "undefined" &&
      (role === "host" ||
        (readPreviewControllerParent() !== null &&
          new URLSearchParams(window.location.search).get(
            AIR_JAM_PREVIEW_CAPTURE_QUERY_PARAM,
          ) === "1")) &&
      supportsStageCapture(),
  );
  const mount = useCallback((element: HTMLCanvasElement | null) => {
    if (!element) return;
    const canvas = element as StageCaptureCanvas;
    const context = canvas.getContext("2d") as
      | (CanvasRenderingContext2D & {
          drawElementImage: (
            root: Element,
            x: number,
            y: number,
            width: number,
            height: number,
          ) => void;
        })
      | null;
    const root = canvas.firstElementChild;
    if (!context || !root)
      throw new Error("The stage capture surface could not mount.");
    const paint = () => {
      context.reset();
      context.drawElementImage(root, 0, 0, canvas.width, canvas.height);
    };
    const resize = () => {
      canvas.width = Math.max(
        1,
        Math.round(canvas.clientWidth * window.devicePixelRatio),
      );
      canvas.height = Math.max(
        1,
        Math.round(canvas.clientHeight * window.devicePixelRatio),
      );
      canvas.requestPaint();
    };
    canvas.addEventListener("paint", paint);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => {
      observer.disconnect();
      canvas.removeEventListener("paint", paint);
    };
  }, []);
  if (!enabled) return children;
  return (
    <canvas
      {...{ content: "drawable", "data-airjam-stage-capture": "" }}
      className="fixed inset-0 block h-dvh w-screen"
      ref={mount}
    >
      {/* Chrome draws a nested canvas's pixels from the drawable root's
          origin, clipped to the canvas's own box, so a game's canvas shows
          blank unless it paints in its own containment. */}
      <div
        {...{ drawable: "" }}
        className="h-dvh w-screen [&_canvas]:[contain:paint]"
      >
        {children}
      </div>
    </canvas>
  );
}
