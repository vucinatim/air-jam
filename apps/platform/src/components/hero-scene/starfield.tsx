"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const WORLD_CONFIG = {
  SPEED: 24, // units per second (0.4 per frame at 60fps)
};

export const Starfield = () => {
  const starsRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 1000;
    const starPos = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 400;
      starPos[i * 3 + 1] = 10 + Math.random() * 100;
      // Distribute along Z from -200 to 20
      starPos[i * 3 + 2] = Math.random() * 220 - 200;
    }

    starsGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.2,
      depthWrite: false,
    });

    return {
      geometry: starsGeo,
      material: starsMat,
    };
  }, []);

  useFrame((state, delta) => {
    if (starsRef.current) {
      const positions = starsRef.current.geometry.attributes.position
        .array as Float32Array;
      const count = positions.length / 3;

      for (let i = 0; i < count; i++) {
        // Move Z
        positions[i * 3 + 2] += WORLD_CONFIG.SPEED * 0.5 * delta;

        // Check boundary (Camera is at ~12)
        if (positions[i * 3 + 2] > 10) {
          // Reset to far distance
          positions[i * 3 + 2] -= 220;
        }
      }

      starsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points
      ref={starsRef}
      geometry={geometry}
      material={material}
      renderOrder={-1}
    ></points>
  );
};
