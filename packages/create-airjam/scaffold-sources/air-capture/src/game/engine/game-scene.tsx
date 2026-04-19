import { PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { CollectibleSpawner } from "../components/entities/collectible-spawner";
import { Decals } from "../components/entities/decals";
import { Lasers } from "../components/entities/lasers";
import { Rockets } from "../components/entities/rockets";
import { AirCaptureArena } from "../prefabs/arena";
import { Collectibles } from "../scene-population/collectibles";
import { Ships } from "../scene-population/ships";
import { useDebugStore } from "../stores/debug/debug-store";
import { useGameStore } from "../stores/players/game-store";
import { ArenaBounds } from "./arena-bounds";
import { FreeFlyCamera } from "./free-fly-camera";
import { useCameraFollow } from "./use-camera-follow";
import { useCameraViewports } from "./use-camera-viewports";
import { useMultiViewportRenderer } from "./use-multi-viewport-renderer";

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
  onCanvasReady,
  mode = "match",
  paused = false,
}: {
  onCamerasReady?: (
    cameras: Array<{
      camera: ThreePerspectiveCamera;
      viewport: { x: number; y: number; width: number; height: number };
    }>,
  ) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  mode?: "match" | "spectator";
  paused?: boolean;
}) {
  const isDebugPanelOpen = useDebugStore((state) => state.isOpen);

  return (
    <Canvas
      shadows
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        onCanvasReady?.(gl.domElement);
      }}
    >
      <Physics
        paused={paused}
        gravity={[0, 0, 0]}
        interpolate={true}
        timeStep="vary"
        debug={mode === "match" ? isDebugPanelOpen : false}
      >
        <AirCaptureArena />
        <Ships />
        <Lasers />
        <Rockets />
        <Decals />
        <ArenaBounds />
        <Collectibles />
        <CollectibleSpawner />
        {mode === "spectator" ? (
          <SpectatorCamera />
        ) : (
          <MultiCameraController
            onCamerasReady={onCamerasReady || (() => {})}
          />
        )}
      </Physics>
    </Canvas>
  );
}
