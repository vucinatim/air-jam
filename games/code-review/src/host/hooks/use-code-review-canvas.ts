import { useCallback, useEffect, useRef } from "react";
import { createArenaColors, setupCanvas } from "../../game/engine/render";

type ArenaColors = ReturnType<typeof createArenaColors>;

export const useCodeReviewCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const arenaColorsRef = useRef<ArenaColors | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    contextRef.current = context;
    arenaColorsRef.current = createArenaColors(
      getComputedStyle(document.documentElement),
    );
    setupCanvas(canvas, context);

    return () => {
      contextRef.current = null;
      arenaColorsRef.current = null;
    };
  }, []);

  return {
    canvasRef,
    getContext: useCallback(() => contextRef.current, []),
    getArenaColors: useCallback(() => arenaColorsRef.current, []),
  };
};
