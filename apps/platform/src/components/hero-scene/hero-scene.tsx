"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GridFloor } from "./grid-floor";
import { Mountains } from "./mountains";
import { Ship } from "./ship";
import { Starfield } from "./starfield";

function SceneContent() {
  const shipGroupRef = useRef<THREE.Group>(null);
  const mouse = useRef(new THREE.Vector2());
  const targetMouse = useRef(new THREE.Vector2());

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
    const fixedHeight = 0;
    const hoverBob = Math.sin(time * 3) * 0.1;

    // Physics-like movement
    const speedFactor = 0.04;
    const currentX = shipGroupRef.current.position.x;

    // Move X
    shipGroupRef.current.position.x += (targetX - currentX) * speedFactor;

    // Move Y (Constant height + bob only)
    shipGroupRef.current.position.y +=
      (fixedHeight + hoverBob - shipGroupRef.current.position.y) * 0.1;

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

    // Update Camera (Lag & Tilt)
    state.camera.position.x +=
      (shipGroupRef.current.position.x * 0.5 - state.camera.position.x) * 0.06;
    state.camera.lookAt(
      shipGroupRef.current.position.x * 0.6,
      shipGroupRef.current.position.y,
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
