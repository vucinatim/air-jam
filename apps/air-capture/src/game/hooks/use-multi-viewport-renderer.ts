import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { useDebugStore } from "../debug-store";
import { computeViewports } from "../utils/camera-utils";

export function useMultiViewportRenderer(
  activeCamerasRef: React.MutableRefObject<
    Array<ThreePerspectiveCamera | null>
  >,
) {
  const { gl, size } = useThree();
  const freeFlyMode = useDebugStore((state) => state.freeFlyMode);

  useEffect(() => {
    // Skip multi-viewport rendering when in free-fly mode
    if (freeFlyMode) return;

    const renderer = gl;
    const originalRender = renderer.render.bind(renderer);

    // eslint-disable-next-line react-hooks/immutability
    renderer.autoClear = false;

    renderer.render = (sceneToRender) => {
      const cameras = activeCamerasRef.current.filter(Boolean);
      if (cameras.length === 0) return;

      const viewports = computeViewports(
        cameras.length,
        size.width,
        size.height,
      );
      renderer.setScissorTest(true);

      viewports.forEach((vp, index) => {
        const cam = cameras[index];
        if (!cam) return;

        cam.aspect = vp.width / vp.height;
        cam.updateProjectionMatrix();

        renderer.setViewport(vp.x, vp.y, vp.width, vp.height);
        renderer.setScissor(vp.x, vp.y, vp.width, vp.height);
        if (index === 0) {
          renderer.clear();
        } else {
          renderer.clearDepth();
        }
        originalRender(sceneToRender, cam);
      });

      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, size.width, size.height);
      renderer.setScissor(0, 0, size.width, size.height);
    };

    return () => {
      renderer.render = originalRender;
      renderer.autoClear = true;
      renderer.setScissorTest(false);
    };
  }, [gl, size.width, size.height, activeCamerasRef, freeFlyMode]);
}
