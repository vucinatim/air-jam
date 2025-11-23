import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { PLAYER_CAMERA_OFFSET, TOPDOWN_CAMERA_HEIGHT } from "../constants";
import { useGameStore } from "../game-store";
import { shipPositions, shipRotations } from "../components/Ship";

interface CameraFollowState {
  targetPosition: Vector3;
  currentPosition: Vector3;
  lookTarget: Vector3;
}

export function useCameraFollow(
  cameraRefs: Array<React.RefObject<ThreePerspectiveCamera | null>>,
  activeCamerasRef: React.MutableRefObject<Array<ThreePerspectiveCamera | null>>,
  cameraMode: "follow" | "topdown"
) {
  const followStateRef = useRef<CameraFollowState[]>(
    Array.from({ length: 4 }, () => ({
      targetPosition: new Vector3(),
      currentPosition: new Vector3(),
      lookTarget: new Vector3(),
    }))
  );
  const topTargetRef = useRef(new Vector3(0, 0, 0));
  const players = useGameStore((state) => state.players);
  const cameraModeRef = useRef(cameraMode);

  useFrame((_state, delta) => {
    cameraModeRef.current = cameraMode;

    const maxCams = 4;
    const playerCount = Math.min(players.length, maxCams);
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

      const player = players[i];
      const isSingleTopDown =
        activeCount === 1 && cameraModeRef.current === "topdown";

      if (isSingleTopDown) {
        // No players, top-down spectate
        const targetPos = new Vector3(0, TOPDOWN_CAMERA_HEIGHT, 0);
        cam.position.lerp(targetPos, Math.min(1, delta * 6));
        cam.lookAt(topTargetRef.current);
        continue;
      }

      if (!player) continue;

      const shipPos = shipPositions.get(player.controllerId);
      const shipRot = shipRotations.get(player.controllerId);
      if (!shipPos || !shipRot) continue;

      const offset = new Vector3(
        PLAYER_CAMERA_OFFSET.x,
        PLAYER_CAMERA_OFFSET.y,
        PLAYER_CAMERA_OFFSET.z
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

