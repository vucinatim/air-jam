import { useCallback, useEffect, useRef } from "react";

interface UsePongCanvasOptions {
  width: number;
  height: number;
  resetKey: unknown;
}

export const usePongCanvas = ({
  width,
  height,
  resetKey,
}: UsePongCanvasOptions) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    contextRef.current = ctx;

    return () => {
      contextRef.current = null;
    };
  }, [height, resetKey, width]);

  const getContext = useCallback(() => contextRef.current, []);

  return { canvasRef, getContext };
};
