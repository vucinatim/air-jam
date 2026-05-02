"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GridFloor } from "./grid-floor";
import { Mountains } from "./mountains";
import { Ship } from "./ship";
import { Starfield } from "./starfield";

/** 0 on desktop, 1 on the narrowest phone. */
function mobileFactor(px: number): number {
  if (px >= 1024) return 0;
  return 1 - Math.max(0, Math.min(1, (px - 375) / (1024 - 375)));
}

/*
 * Desktop camera defaults (unchanged).
 * On mobile the camera pulls back and up proportionally so the viewing
 * angle is preserved but everything appears smaller.
 *
 * Desktop: camera [0, 4, 12]  → ratio Y/Z = 4/12 = 0.333
 * Phone:   camera [0, 8, 24]  → ratio Y/Z = 8/24 = 0.333  (same angle)
 */
const BASE_CAM_Y = 4;
const BASE_CAM_Z = 12;
const MOBILE_CAM_Z_EXTRA = 8; // Z goes 12 → 24
const MOBILE_CAM_Y_EXTRA = 4; // Y goes  4 →  8  (keeps the same angle)
const MOBILE_LOOKAT_Y_LIFT = 3; // aim well above ship so it sits near bottom

function SceneContent() {
  const shipGroupRef = useRef<THREE.Group>(null);
  const mouse = useRef(new THREE.Vector2());
  const targetMouse = useRef(new THREE.Vector2());

  // Read the canvas pixel width from R3F's viewport state.
  // `state.size.width` updates automatically when the canvas resizes.
  const canvasWidth = useThree((s) => s.size.width);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      targetMouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useFrame((state) => {
    if (!shipGroupRef.current) return;

    const time = state.clock.getElapsedTime();

    // Smooth mouse tracking
    mouse.current.x += (targetMouse.current.x - mouse.current.x) * 0.06;

    // Flight parameters
    const maxRangeX = 8.0;
    const targetX = mouse.current.x * maxRangeX;
    const hoverBob = Math.sin(time * 3) * 0.1;

    // Physics-like movement
    const speedFactor = 0.04;
    const currentX = shipGroupRef.current.position.x;

    // Move X
    shipGroupRef.current.position.x += (targetX - currentX) * speedFactor;

    // Aerodynamics (Steering & Banking)
    const velocityX = targetX - currentX;

    // Roll (Bank)
    const maxBankAngle = 0.6;
    const bankSensitivity = 0.8;
    const targetRotZ = -(velocityX * bankSensitivity);

    // Yaw (Turn)
    const yawSensitivity = 0.15;
    const targetRotY = -(velocityX * yawSensitivity);

    // Pitch: Level
    const targetRotX = 0;

    // Damping Sync
    const rotSpeed = 0.06;

    shipGroupRef.current.rotation.z +=
      (THREE.MathUtils.clamp(targetRotZ, -maxBankAngle, maxBankAngle) -
        shipGroupRef.current.rotation.z) *
      rotSpeed;
    shipGroupRef.current.rotation.y +=
      (targetRotY - shipGroupRef.current.rotation.y) * rotSpeed;
    shipGroupRef.current.rotation.x +=
      (targetRotX - shipGroupRef.current.rotation.x) * rotSpeed;

    // Responsive layout -- pull camera back AND up on narrow viewports.
    // Keeping the Y/Z ratio constant preserves the viewing angle so the
    // ship doesn't appear to sink toward the ground.
    const m = mobileFactor(canvasWidth);

    const targetCamZ = BASE_CAM_Z + m * MOBILE_CAM_Z_EXTRA;
    const targetCamY = BASE_CAM_Y + m * MOBILE_CAM_Y_EXTRA;

    state.camera.position.z += (targetCamZ - state.camera.position.z) * 0.08;
    state.camera.position.y += (targetCamY - state.camera.position.y) * 0.08;

    // Ship stays at its original world position -- only hover bob on Y
    shipGroupRef.current.position.y +=
      (hoverBob - shipGroupRef.current.position.y) * 0.1;

    // Update Camera (Lag & Tilt)
    // On mobile, aim the camera above the ship so it sits in the lower
    // portion of the viewport, leaving room for the text overlay above.
    const lookAtYLift = m * MOBILE_LOOKAT_Y_LIFT;

    state.camera.position.x +=
      (shipGroupRef.current.position.x * 0.5 - state.camera.position.x) * 0.06;
    state.camera.lookAt(
      shipGroupRef.current.position.x * 0.6,
      shipGroupRef.current.position.y + lookAtYLift,
      shipGroupRef.current.position.z - 20,
    );
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <Ship groupRef={shipGroupRef} />
      <GridFloor />
      <Mountains />
      <Starfield />
    </>
  );
}

export const HeroScene = () => {
  const dpr =
    typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1;

  return (
    <div className="absolute inset-0 -z-10">
      <Canvas
        gl={{ antialias: true }}
        shadows
        camera={{ position: [0, 4.0, 12.0], fov: 60 }}
        dpr={dpr}
      >
        <color attach="background" args={[0x020205]} />
        <fog attach="fog" args={[0x020205, 20, 120]} />
        <SceneContent />
      </Canvas>
    </div>
  );
};
