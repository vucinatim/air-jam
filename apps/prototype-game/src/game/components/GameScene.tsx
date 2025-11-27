import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { PerspectiveCamera } from "@react-three/drei";
import { useRef, useEffect } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { useGameStore } from "../game-store";
import { useDebugStore } from "../debug-store";
import { Ships } from "./Ships";
import { SpaceEnvironment } from "./SpaceEnvironment";
import { Obstacles } from "./Obstacles";
import { Lasers } from "./Lasers";
import { Rockets } from "./Rockets";
import { Decals } from "./Decals";
import { ArenaBounds } from "./ArenaBounds";
import { Collectibles } from "./Collectibles";
import { CollectibleSpawner } from "./CollectibleSpawner";
import { JumpPads } from "./JumpPads";
import { PlayerBases } from "./PlayerBases";
import { Flags } from "./Flags";
import { FreeFlyCamera } from "./FreeFlyCamera";
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
  const freeFlyMode = useDebugStore((state) => state.freeFlyMode);
  const cameraRef1 = useRef<ThreePerspectiveCamera>(null);
  const cameraRef2 = useRef<ThreePerspectiveCamera>(null);
  const cameraRef3 = useRef<ThreePerspectiveCamera>(null);
  const cameraRef4 = useRef<ThreePerspectiveCamera>(null);
  const cameraRefs = [cameraRef1, cameraRef2, cameraRef3, cameraRef4];
  const activeCamerasRef = useRef<Array<ThreePerspectiveCamera | null>>([]);

  // Always call hooks (React rules), but they check freeFlyMode internally
  useMultiViewportRenderer(activeCamerasRef);
  useCameraFollow(cameraRefs, activeCamerasRef, cameraMode);
  const camerasWithViewports = useCameraViewports(activeCamerasRef);

  useEffect(() => {
    if (camerasWithViewports.length > 0 && !freeFlyMode) {
      onCamerasReady(camerasWithViewports);
    }
  }, [camerasWithViewports, onCamerasReady, freeFlyMode]);

  if (freeFlyMode) {
    return (
      <FreeFlyCamera
        onCameraReady={(camera) => {
          onCamerasReady([
            {
              camera,
              viewport: { x: 0, y: 0, width: 1, height: 1 },
            },
          ]);
        }}
      />
    );
  }

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef1}
        fov={75}
        near={0.1}
        far={5000}
        position={[0, 5, 10]}
      />
      <PerspectiveCamera
        ref={cameraRef2}
        fov={75}
        near={0.1}
        far={5000}
        position={[0, 5, 10]}
      />
      <PerspectiveCamera
        ref={cameraRef3}
        fov={75}
        near={0.1}
        far={5000}
        position={[0, 5, 10]}
      />
      <PerspectiveCamera
        ref={cameraRef4}
        fov={75}
        near={0.1}
        far={5000}
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
  const isDebugPanelOpen = useDebugStore((state) => state.isOpen);

  return (
    <Canvas shadows gl={{ antialias: true }}>
      <Physics
        gravity={[0, 0, 0]}
        interpolate={true}
        timeStep="vary"
        debug={isDebugPanelOpen}
      >
        <SpaceEnvironment />
        <Ships />
        <Obstacles />
        <Lasers />
        <Rockets />
        <Decals />
        <ArenaBounds />
        <Collectibles />
        <CollectibleSpawner />
        <PlayerBases />
        <Flags />
        <JumpPads />
        <MultiCameraController onCamerasReady={onCamerasReady || (() => {})} />
      </Physics>
    </Canvas>
  );
}
