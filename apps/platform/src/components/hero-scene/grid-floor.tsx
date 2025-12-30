"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const WORLD_CONFIG = {
  SPEED: 24, // units per second (0.4 per frame at 60fps)
  FLOOR_SIZE: 400,
  GRID_REPEAT: 10,
};

export const GridFloor = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  const { material, geometry } = useMemo(() => {
    // Create grid texture
    const gridCanvas = document.createElement("canvas");
    gridCanvas.width = 1024;
    gridCanvas.height = 1024;
    const ctx = gridCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.strokeStyle = "#00D3F3";
      ctx.lineWidth = 1;

      ctx.beginPath();
      for (let i = 0; i <= 1024; i += 128) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 1024);
        ctx.moveTo(0, i);
        ctx.lineTo(1024, i);
      }
      ctx.stroke();
    }

    const gridTexture = new THREE.CanvasTexture(gridCanvas);
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.anisotropy = 16;
    gridTexture.repeat.set(WORLD_CONFIG.GRID_REPEAT, WORLD_CONFIG.GRID_REPEAT);

    const planeMat = new THREE.MeshStandardMaterial({
      map: gridTexture,
      roughness: 0.1,
      metalness: 0.8,
      emissive: 0x002244,
      emissiveIntensity: 0.2,
    });

    const planeGeo = new THREE.PlaneGeometry(
      WORLD_CONFIG.FLOOR_SIZE,
      WORLD_CONFIG.FLOOR_SIZE,
    );

    return {
      texture: gridTexture,
      material: planeMat,
      geometry: planeGeo,
    };
  }, []);

  useFrame((state, delta) => {
    if (meshRef.current?.material) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (mat.map) {
        const gridTexture = mat.map as THREE.CanvasTexture;
        const offsetSpeed =
          (WORLD_CONFIG.SPEED * WORLD_CONFIG.GRID_REPEAT) /
          WORLD_CONFIG.FLOOR_SIZE;
        gridTexture.offset.y += offsetSpeed * delta;
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -2.0, 0]}
      geometry={geometry}
      material={material}
    />
  );
};
