import { useCallback, useRef } from "react";

interface UsePongCanvasOptions {
  width: number;
  height: number;
}

export const usePongCanvas = ({ width, height }: UsePongCanvasOptions) => {
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      contextRef.current = null;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Pong requires a 2D canvas context.");
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      contextRef.current = context;
    },
    [height, width],
  );

  const getContext = useCallback(() => contextRef.current, []);

  return { canvasRef, getContext };
};
