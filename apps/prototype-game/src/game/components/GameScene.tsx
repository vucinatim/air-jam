import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics, useRapier } from "@react-three/rapier";
import { PerspectiveCamera } from "@react-three/drei";
import { useRef } from "react";
import { Vector3 } from "three";
import {
  ARENA_RADIUS,
  PLAYER_CAMERA_OFFSET,
  TOPDOWN_CAMERA_HEIGHT,
} from "../constants";
import { useGameStore } from "../game-store";
import { shipPositions, shipRotations } from "./Ship";
import { Ships } from "./Ships";
import { SpaceEnvironment } from "./SpaceEnvironment";
import { Obstacles } from "./Obstacles";

function ArenaBounds() {
  const { world } = useRapier();

  useFrame(() => {
    if (!world) return;

    // Enforce arena bounds on all dynamic bodies
    world.bodies.forEach((body) => {
      if (body.bodyType() === 0) {
        // Dynamic body
        const pos = body.translation();
        const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        if (dist > ARENA_RADIUS) {
          const clamped = new Vector3(pos.x, pos.y, pos.z).setLength(
            ARENA_RADIUS - 1
          );
          body.setTranslation({ x: clamped.x, y: pos.y, z: clamped.z }, true);
          body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
    });
  });

  return null;
}

function CameraController() {
  const { camera } = useThree();
  const players = useGameStore((state) => state.players);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const targetPositionRef = useRef(new Vector3());
  const currentPositionRef = useRef(new Vector3());
  const lookTargetRef = useRef(new Vector3());

  useFrame((_state, delta) => {
    if (cameraMode === "topdown") {
      // Static top-down camera
      const topDownPosition = new Vector3(0, TOPDOWN_CAMERA_HEIGHT, 0);
      const smoothFactor = Math.min(1, delta * 6);
      currentPositionRef.current
        .copy(camera.position)
        .lerp(topDownPosition, smoothFactor);
      camera.position.copy(currentPositionRef.current);
      camera.lookAt(0, 0, 0);
      return;
    }

    // Follow mode - follow the first player's ship
    if (players.length === 0) return;

    const firstPlayer = players[0];
    const shipPos = shipPositions.get(firstPlayer.controllerId);
    const shipRot = shipRotations.get(firstPlayer.controllerId);

    if (!shipPos || !shipRot) return;

    // Calculate camera offset in ship's local space
    const offset = new Vector3(
      PLAYER_CAMERA_OFFSET.x,
      PLAYER_CAMERA_OFFSET.y,
      PLAYER_CAMERA_OFFSET.z
    ).applyQuaternion(shipRot);

    // Calculate target position
    targetPositionRef.current.copy(shipPos).add(offset);

    // Smoothly interpolate camera position with delta-based easing
    const positionSmoothFactor = Math.min(1, delta * 6); // Adjust speed (6 = responsive, higher = faster)
    currentPositionRef.current
      .copy(camera.position)
      .lerp(targetPositionRef.current, positionSmoothFactor);
    camera.position.copy(currentPositionRef.current);

    // Calculate look-ahead target for smoother camera rotation
    const lookAhead = new Vector3(0, 0, -5).applyQuaternion(shipRot);
    lookTargetRef.current.copy(shipPos).add(lookAhead);

    // Smoothly rotate camera to look at target (faster rotation for better responsiveness)
    const currentLookAt = new Vector3();
    camera.getWorldDirection(currentLookAt);
    currentLookAt.multiplyScalar(100).add(camera.position);

    const targetDirection = lookTargetRef.current
      .clone()
      .sub(camera.position)
      .normalize();
    const currentDirection = currentLookAt.sub(camera.position).normalize();

    // Use faster rotation smoothing (higher multiplier for more responsive rotation)
    const rotationSmoothFactor = Math.min(1, delta * 12); // 2x faster than position
    const lerpedDirection = currentDirection
      .clone()
      .lerp(targetDirection, rotationSmoothFactor);
    const finalLookAt = camera.position
      .clone()
      .add(lerpedDirection.multiplyScalar(100));

    camera.lookAt(finalLookAt);
  });

  return null;
}

export function GameScene() {
  return (
    <Canvas shadows gl={{ antialias: true }}>
      <PerspectiveCamera
        makeDefault
        fov={75}
        near={0.1}
        far={1000}
        position={[0, 5, 10]}
      />
      <Physics gravity={[0, 0, 0]} interpolate={true} timeStep="vary">
        <SpaceEnvironment />
        <Ships />
        <Obstacles />
        <ArenaBounds />
        <CameraController />
      </Physics>
    </Canvas>
  );
}
