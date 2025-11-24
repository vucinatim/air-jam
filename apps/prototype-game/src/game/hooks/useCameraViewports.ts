import { useEffect, useState, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { computeViewports } from "../utils/camera-utils";

export function useCameraViewports(
  activeCamerasRef: React.MutableRefObject<Array<ThreePerspectiveCamera | null>>
) {
  const { size } = useThree();
  const [camerasWithViewports, setCamerasWithViewports] = useState<
    Array<{ camera: ThreePerspectiveCamera; viewport: { x: number; y: number; width: number; height: number } }>
  >([]);
  const prevSizeRef = useRef({ width: size.width, height: size.height });

  useEffect(() => {
    const update = () => {
      const cameras = activeCamerasRef.current.filter(Boolean) as ThreePerspectiveCamera[];
      if (cameras.length === 0) {
        setCamerasWithViewports([]);
        return;
      }

      const viewports = computeViewports(cameras.length, size.width, size.height);
      const camerasWithVp = cameras.map((cam, index) => ({
        camera: cam,
        viewport: viewports[index],
      }));

      // Only update if cameras or viewports actually changed
      setCamerasWithViewports((prev) => {
        if (prev.length !== camerasWithVp.length) return camerasWithVp;
        
        // Check if cameras or viewports changed
        const changed = prev.some((p, i) => {
          const current = camerasWithVp[i];
          if (!current) return true;
          return (
            p.camera !== current.camera ||
            p.viewport.x !== current.viewport.x ||
            p.viewport.y !== current.viewport.y ||
            p.viewport.width !== current.viewport.width ||
            p.viewport.height !== current.viewport.height
          );
        });
        
        return changed ? camerasWithVp : prev;
      });
    };

    // Only update if size changed
    if (
      prevSizeRef.current.width !== size.width ||
      prevSizeRef.current.height !== size.height
    ) {
      prevSizeRef.current = { width: size.width, height: size.height };
      update();
    }

    const interval = setInterval(update, 500); // Reduced frequency to 500ms

    return () => clearInterval(interval);
  }, [activeCamerasRef, size.width, size.height]);

  // Memoize to prevent reference changes
  return useMemo(() => camerasWithViewports, [camerasWithViewports]);
}

