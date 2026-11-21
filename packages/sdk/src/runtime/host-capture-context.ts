import { createContext } from "react";
import type { HostCanvasDraw } from "../agent/host-canvas-capture";

export const hostCaptureContext = createContext<{
  setDraw: (draw: HostCanvasDraw | null) => void;
  rendered: () => void;
} | null>(null);
