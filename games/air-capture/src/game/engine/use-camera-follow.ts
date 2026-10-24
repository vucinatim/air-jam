import { useSimulation } from "@air-jam/sdk";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import {
  Vector3,
  type PerspectiveCamera as ThreePerspectiveCamera,
} from "three";
import { PLAYER_CAMERA_OFFSET } from "../constants";
import type { AirCaptureSim } from "../simulation/state";
import { useDebugStore } from "../stores/debug/debug-store";

interface CameraFollowState {
  targetPosition: Vector3;
  currentPosition: Vector3;
  lookTarget: Vector3;
}

export function useCameraFollow(
  cameraRefs: Array<React.RefObject<ThreePerspectiveCamera | null>>,
  activeCamerasRef: React.MutableRefObject<
    Array<ThreePerspectiveCamera | null>
  >,
) {
  const followStateRef = useRef<CameraFollowState[]>(
    Array.from({ length: 4 }, () => ({
      targetPosition: new Vector3(),
      currentPosition: new Vector3(),
      lookTarget: new Vector3(),
    })),
  );
  const clock = useSimulation<AirCaptureSim>();
  const freeFlyMode = useDebugStore((state) => state.freeFlyMode);

  useFrame((_state, delta) => {
    // Skip camera follow updates when in free-fly mode
    if (freeFlyMode) return;

    const ships = [...clock.sim.ships.values()];
    const maxCams = 4;
    const playerCount = Math.min(ships.length, maxCams);
    const cameras = cameraRefs.map((ref) => ref.current).filter(Boolean);

    // When no players, keep a single top-down camera so scene still shows.
    const activeCount = Math.max(1, playerCount);
    activeCamerasRef.current = cameras.slice(0, activeCount);
    const viewStates = followStateRef.current;

    // Update follow cameras for each player slot
    for (let i = 0; i < activeCount; i += 1) {
      const cam = cameras[i];
      const viewState = viewStates[i];
      if (!cam || !viewState) continue;

      const ship = ships[i];
      if (!ship) continue;
      const shipPos = ship.position;
      const shipRot = ship.rotation;

      const offset = new Vector3(
        PLAYER_CAMERA_OFFSET.x,
        PLAYER_CAMERA_OFFSET.y,
        PLAYER_CAMERA_OFFSET.z,
      ).applyQuaternion(shipRot);

      viewState.targetPosition.copy(shipPos).add(offset);
      const positionSmoothFactor = Math.min(1, delta * 6);
      viewState.currentPosition
        .copy(cam.position)
        .lerp(viewState.targetPosition, positionSmoothFactor);
      cam.position.copy(viewState.currentPosition);

      const lookAhead = new Vector3(0, 0, -5).applyQuaternion(shipRot);
      viewState.lookTarget.copy(shipPos).add(lookAhead);

      const currentLookAt = new Vector3();
      cam.getWorldDirection(currentLookAt);
      currentLookAt.multiplyScalar(100).add(cam.position);

      const targetDirection = viewState.lookTarget
        .clone()
        .sub(cam.position)
        .normalize();
      const currentDirection = currentLookAt.sub(cam.position).normalize();

      const rotationSmoothFactor = Math.min(1, delta * 12);
      const lerpedDirection = currentDirection
        .clone()
        .lerp(targetDirection, rotationSmoothFactor);
      const finalLookAt = cam.position
        .clone()
        .add(lerpedDirection.multiplyScalar(100));
      cam.lookAt(finalLookAt);
    }
  });
}
