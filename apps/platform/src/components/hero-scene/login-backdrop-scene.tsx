"use client";

import { Canvas } from "@react-three/fiber";
import { GridFloor } from "./grid-floor";
import { Starfield } from "./starfield";

function LoginBackdropContent() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[8, 16, 8]} intensity={1.1} />
      <GridFloor />
      <Starfield />
    </>
  );
}

export const LoginBackdropScene = () => {
  const dpr =
    typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1;

  return (
    <div className="absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 3.8, 12], fov: 60 }} dpr={dpr}>
        <color attach="background" args={[0x020205]} />
        <fog attach="fog" args={[0x020205, 18, 110]} />
        <LoginBackdropContent />
      </Canvas>
    </div>
  );
};
