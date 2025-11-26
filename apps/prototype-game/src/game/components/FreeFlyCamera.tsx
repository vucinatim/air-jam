import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera as ThreePerspectiveCamera, Vector3 } from "three";
import type { PerspectiveCamera } from "three";

interface FreeFlyCameraProps {
  onCameraReady?: (camera: PerspectiveCamera) => void;
}

export function FreeFlyCamera({ onCameraReady }: FreeFlyCameraProps) {
  const { camera, gl } = useThree();
  const moveSpeed = 100;
  const keys = useRef<Set<string>>(new Set());
  const euler = useRef({ x: 0, y: 0 });
  const velocity = useRef(new Vector3());
  const isInitialized = useRef(false);

  // Set up the camera
  useEffect(() => {
    if (!isInitialized.current && camera instanceof ThreePerspectiveCamera) {
      camera.position.set(0, 10, 20);
      camera.lookAt(0, 0, 0);
      camera.far = 5000; // Ensure stars are visible
      camera.near = 0.1;
      camera.updateProjectionMatrix();
      euler.current.y = camera.rotation.y;
      euler.current.x = camera.rotation.x;
      isInitialized.current = true;
      if (onCameraReady) {
        onCameraReady(camera);
      }
    }
  }, [camera, onCameraReady]);

  // Keyboard input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        const sensitivity = 0.002;
        euler.current.y -= e.movementX * sensitivity;
        euler.current.x -= e.movementY * sensitivity;
        euler.current.x = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, euler.current.x)
        );
      }
    };

    const handlePointerLockChange = () => {
      if (document.pointerLockElement !== gl.domElement) {
        keys.current.clear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    // Request pointer lock on click
    const handleClick = () => {
      if (document.pointerLockElement !== gl.domElement) {
        gl.domElement.requestPointerLock();
      }
    };

    gl.domElement.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      gl.domElement.removeEventListener("click", handleClick);
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock();
      }
    };
  }, [gl.domElement]);

  // Movement update
  useFrame((_state, delta) => {
    if (!(camera instanceof ThreePerspectiveCamera)) return;

    const isLocked = document.pointerLockElement === gl.domElement;

    if (isLocked) {
      // Apply rotation
      camera.rotation.order = "YXZ";
      camera.rotation.y = euler.current.y;
      camera.rotation.x = euler.current.x;
      camera.rotation.z = 0;
      // Update quaternion from rotation (Three.js does this automatically, but we ensure it)
      camera.updateMatrixWorld();

      // Calculate movement direction based on current rotation
      const direction = new Vector3();
      const forward = new Vector3(0, 0, -1);
      const right = new Vector3(1, 0, 0);
      const up = new Vector3(0, 1, 0);

      // Apply camera's quaternion to direction vectors
      forward.applyQuaternion(camera.quaternion);
      right.applyQuaternion(camera.quaternion);

      // WASD movement
      if (keys.current.has("w")) direction.add(forward);
      if (keys.current.has("s")) direction.sub(forward);
      if (keys.current.has("a")) direction.sub(right);
      if (keys.current.has("d")) direction.add(right);
      if (keys.current.has(" ")) direction.add(up); // Space
      if (keys.current.has("shift")) direction.sub(up); // Shift

      // Normalize and apply speed
      if (direction.length() > 0) {
        direction.normalize();
        velocity.current.lerp(direction.multiplyScalar(moveSpeed), 0.2);
      } else {
        velocity.current.lerp(new Vector3(), 0.1);
      }

      // Apply movement
      camera.position.add(velocity.current.clone().multiplyScalar(delta));
    }
  });

  return null;
}

