import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { PerspectiveCamera } from "@react-three/drei";
import { useRef, useEffect } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { useGameStore } from "../game-store";
import { Ships } from "./Ships";
import { SpaceEnvironment } from "./SpaceEnvironment";
import { Obstacles } from "./Obstacles";
import { Lasers } from "./Lasers";
import { Rockets } from "./Rockets";
import { Decals } from "./Decals";
import { ArenaBounds } from "./ArenaBounds";
import { Collectibles } from "./Collectibles";
import { CollectibleSpawner } from "./CollectibleSpawner";
import { useMultiViewportRenderer } from "../hooks/useMultiViewportRenderer";
import { useCameraFollow } from "../hooks/useCameraFollow";
import { useCameraViewports } from "../hooks/useCameraViewports";
// Import abilities to register them
import "../abilities/health-pack";
import "../abilities/speed-boost";
import "../abilities/rocket";

function MultiCameraController({
  onCamerasReady,
}: {
  onCamerasReady: (
    cameras: Array<{
      camera: ThreePerspectiveCamera;
      viewport: { x: number; y: number; width: number; height: number };
    }>
  ) => void;
}) {
  const cameraMode = useGameStore((state) => state.cameraMode);
  const cameraRef1 = useRef<ThreePerspectiveCamera>(null);
  const cameraRef2 = useRef<ThreePerspectiveCamera>(null);
  const cameraRef3 = useRef<ThreePerspectiveCamera>(null);
  const cameraRef4 = useRef<ThreePerspectiveCamera>(null);
  const cameraRefs = [cameraRef1, cameraRef2, cameraRef3, cameraRef4];
  const activeCamerasRef = useRef<Array<ThreePerspectiveCamera | null>>([]);

  useMultiViewportRenderer(activeCamerasRef);
  useCameraFollow(cameraRefs, activeCamerasRef, cameraMode);
  const camerasWithViewports = useCameraViewports(activeCamerasRef);

  useEffect(() => {
    if (camerasWithViewports.length > 0) {
      onCamerasReady(camerasWithViewports);
    }
  }, [camerasWithViewports, onCamerasReady]);

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

export function GameScene({
  onCamerasReady,
}: {
  onCamerasReady?: (
    cameras: Array<{
      camera: ThreePerspectiveCamera;
      viewport: { x: number; y: number; width: number; height: number };
    }>
  ) => void;
}) {
  return (
    <Canvas shadows gl={{ antialias: true }}>
      <Physics gravity={[0, 0, 0]} interpolate={true} timeStep="vary">
        <SpaceEnvironment />
        <Ships />
        <Obstacles />
        <Lasers />
        <Rockets />
        <Decals />
        <ArenaBounds />
        <Collectibles />
        <CollectibleSpawner />
        <MultiCameraController onCamerasReady={onCamerasReady || (() => {})} />
      </Physics>
    </Canvas>
  );
}
