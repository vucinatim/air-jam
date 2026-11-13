import { useCallback, useState, type ReactNode } from "react";
import {
  AIR_JAM_PREVIEW_CAPTURE_QUERY_PARAM,
  readPreviewControllerParent,
} from "../preview/identity";
import {
  supportsControllerCapture,
  type ControllerCaptureCanvas,
} from "../runtime/controller-capture";

/** The choice is fixed at mount; real phones keep their original DOM tree. */
export function ControllerCaptureSurface({
  children,
}: {
  children: ReactNode;
}) {
  const [enabled] = useState(
    () =>
      typeof window !== "undefined" &&
      readPreviewControllerParent() !== null &&
      new URLSearchParams(window.location.search).get(
        AIR_JAM_PREVIEW_CAPTURE_QUERY_PARAM,
      ) === "1" &&
      supportsControllerCapture(),
  );
  const mount = useCallback((element: HTMLCanvasElement | null) => {
    if (!element) return;
    const canvas = element as ControllerCaptureCanvas;
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
      throw new Error("The controller capture surface could not mount.");
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
      {...{ content: "drawable", "data-airjam-controller-capture": "" }}
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
