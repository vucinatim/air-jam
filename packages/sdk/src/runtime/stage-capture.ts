export const stageCaptureCanvasSelector = "[data-airjam-stage-capture]";
export type StageCaptureCanvas = HTMLCanvasElement & {
  content: string;
  requestPaint: () => void;
  getContext(contextId: "2d"):
    | (CanvasRenderingContext2D & {
        drawElementImage: (
          element: Element,
          x: number,
          y: number,
          width: number,
          height: number,
        ) => void;
      })
    | null;
};

export function supportsStageCapture() {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas") as StageCaptureCanvas;
  canvas.setAttribute("content", "drawable");
  return (
    canvas.content === "drawable" && typeof canvas.requestPaint === "function"
  );
}
