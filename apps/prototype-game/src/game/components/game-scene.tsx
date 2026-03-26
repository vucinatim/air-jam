import { PerspectiveCamera } from "@react-three/drei";
import {
  Canvas,
  useFrame,
} from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { useDebugStore } from "../debug-store";
import { useGameStore } from "../game-store";
import { useCameraFollow } from "../hooks/use-camera-follow";
import { useCameraViewports } from "../hooks/use-camera-viewports";
import { useMultiViewportRenderer } from "../hooks/use-multi-viewport-renderer";
import { ArenaBounds } from "./arena-bounds";
import { Collectibles } from "./collectibles";
import { CollectibleSpawner } from "./collectible-spawner";
import { Decals } from "./decals";
import { Flags } from "./flags";
import { FreeFlyCamera } from "./free-fly-camera";
import { JumpPads } from "./jump-pads";
import { Lasers } from "./lasers";
import { Obstacles } from "./obstacles";
import { PlayerBases } from "./player-bases";
import { Rockets } from "./rockets";
import { Ships } from "./ships";
import { SpaceEnvironment } from "./space-environment";
// Import abilities to register them
import "../abilities/health-pack";
import "../abilities/rocket";
import "../abilities/speed-boost";

function SpectatorCamera() {
  const cameraRef = useRef<ThreePerspectiveCamera>(null);

  useFrame((state) => {
    const camera = cameraRef.current;
    if (!camera) return;

    const time = state.clock.elapsedTime * 0.18;
    const radius = 220;
    const x = Math.cos(time) * radius;
    const z = Math.sin(time) * radius;
    const y = 95 + Math.sin(time * 1.8) * 10;
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={60}
      near={0.1}
      far={5000}
      position={[180, 95, 180]}
    />
  );
}

function MultiCameraController({
  onCamerasReady,
}: {
  onCamerasReady: (
    cameras: Array<{
      camera: ThreePerspectiveCamera;
      viewport: { x: number; y: number; width: number; height: number };
    }>,
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
  mode = "match",
  paused = false,
}: {
  onCamerasReady?: (
    cameras: Array<{
      camera: ThreePerspectiveCamera;
      viewport: { x: number; y: number; width: number; height: number };
    }>,
  ) => void;
  mode?: "match" | "spectator";
  paused?: boolean;
}) {
  const isDebugPanelOpen = useDebugStore((state) => state.isOpen);

  return (
    <Canvas shadows gl={{ antialias: true }}>
      <Physics
        paused={paused}
        gravity={[0, 0, 0]}
        interpolate={true}
        timeStep="vary"
        debug={mode === "match" ? isDebugPanelOpen : false}
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
        {mode === "spectator" ? (
          <SpectatorCamera />
        ) : (
          <MultiCameraController onCamerasReady={onCamerasReady || (() => {})} />
        )}
      </Physics>
    </Canvas>
  );
}
