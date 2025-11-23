import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { PerspectiveCamera } from "@react-three/drei";
import { useRef } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { useGameStore } from "../game-store";
import { Ships } from "./Ships";
import { SpaceEnvironment } from "./SpaceEnvironment";
import { Obstacles } from "./Obstacles";
import { Lasers } from "./Lasers";
import { Decals } from "./Decals";
import { ArenaBounds } from "./ArenaBounds";
import { useMultiViewportRenderer } from "../hooks/useMultiViewportRenderer";
import { useCameraFollow } from "../hooks/useCameraFollow";

function MultiCameraController() {
  const cameraMode = useGameStore((state) => state.cameraMode);
  const cameraRef1 = useRef<ThreePerspectiveCamera>(null);
  const cameraRef2 = useRef<ThreePerspectiveCamera>(null);
  const cameraRef3 = useRef<ThreePerspectiveCamera>(null);
  const cameraRef4 = useRef<ThreePerspectiveCamera>(null);
  const cameraRefs = [cameraRef1, cameraRef2, cameraRef3, cameraRef4];
  const activeCamerasRef = useRef<Array<ThreePerspectiveCamera | null>>([]);

  useMultiViewportRenderer(activeCamerasRef);
  useCameraFollow(cameraRefs, activeCamerasRef, cameraMode);

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef1}
        fov={75}
        near={0.1}
        far={1000}
        position={[0, 5, 10]}
      />
      <PerspectiveCamera
        ref={cameraRef2}
        fov={75}
        near={0.1}
        far={1000}
        position={[0, 5, 10]}
      />
      <PerspectiveCamera
        ref={cameraRef3}
        fov={75}
        near={0.1}
        far={1000}
        position={[0, 5, 10]}
      />
      <PerspectiveCamera
        ref={cameraRef4}
        fov={75}
        near={0.1}
        far={1000}
        position={[0, 5, 10]}
      />
    </>
  );
}

export function GameScene() {
  return (
    <Canvas shadows gl={{ antialias: true }}>
      <Physics gravity={[0, 0, 0]} interpolate={true} timeStep="vary">
        <SpaceEnvironment />
        <Ships />
        <Obstacles />
        <Lasers />
        <Decals />
        <ArenaBounds />
        <MultiCameraController />
      </Physics>
    </Canvas>
  );
}
