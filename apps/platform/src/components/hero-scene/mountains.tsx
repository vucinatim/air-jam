"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const WORLD_CONFIG = {
  SPEED: 24, // units per second (0.4 per frame at 60fps)
  MOUNTAIN_COLOR: 0xff00cc,
  MOUNTAIN_HEIGHT: 28,
  MOUNTAIN_OFFSET: 38,
};

const CHUNK_LENGTH = 200;
const NUM_CHUNKS = 3;

// Deterministic pseudo-random based on position
const pseudoRandom = (x: number, y: number) => {
  const sin = Math.sin(x * 12.9898 + y * 78.233);
  const val = Math.sin(sin * 43758.5453);
  return val - Math.floor(val);
};

const createMountainStrip = (
  width: number,
  length: number,
  segmentsW: number,
  segmentsL: number,
  side: number,
) => {
  const geo = new THREE.PlaneGeometry(width, length, segmentsW, segmentsL);
  const pos = geo.attributes.position;
  const halfWidth = width / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    // Calculate Taper Factor (0 = Inner/Valley, 1 = Outer/Peak)
    const u = (x + halfWidth) / width;

    // Base Taper: 0 at the track edge, 1 at the outer world edge
    let taper = side === 1 ? u : 1.0 - u;

    // Shoreline variance logic
    const freq = Math.PI / 100;
    const shorelineShift =
      (Math.sin(y * freq) + Math.sin(y * freq * 2.13) * 0.5 + 1.5) * 0.12;

    taper -= shorelineShift;
    taper = Math.max(0, taper);

    // Apply curve
    taper = Math.pow(taper, 0.5);

    // Use deterministic noise instead of random
    // Make noise periodic in Y to ensure seamless looping (y goes from -100 to 100)
    // We wrap y using a sine wave so -100 and 100 map to the same value
    const wrappedY = Math.sin((y / length) * Math.PI * 2);
    const noise = pseudoRandom(x, wrappedY * 50) * WORLD_CONFIG.MOUNTAIN_HEIGHT;

    // Peak is already using cos(y), which is symmetric for -100/100
    const peak = Math.sin(x * 0.2) * 5 + Math.cos(y * 0.1) * 3;

    const height = Math.abs(noise + peak) * taper;

    pos.setZ(i, height);
  }

  geo.computeVertexNormals();

  const group = new THREE.Group();

  const solidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const solidMesh = new THREE.Mesh(geo, solidMat);

  const wireMat = new THREE.MeshBasicMaterial({
    color: WORLD_CONFIG.MOUNTAIN_COLOR,
    wireframe: true,
    transparent: true,
    opacity: 1,
  });
  const wireMesh = new THREE.Mesh(geo, wireMat);
  wireMesh.position.z = 0.05;

  group.add(solidMesh);
  group.add(wireMesh);

  return group;
};

export const Mountains = () => {
  const chunks = useMemo(() => {
    const mountainChunks: THREE.Group[] = [];

    for (const side of [-1, 1]) {
      for (let i = 0; i < NUM_CHUNKS; i++) {
        const strip = createMountainStrip(60, CHUNK_LENGTH, 15, 20, side);
        strip.rotation.x = -Math.PI / 2;

        const xPos = side * WORLD_CONFIG.MOUNTAIN_OFFSET;
        // Start closer to camera to cover the gap at Z=0 to Z=12
        const zPos = 0 - i * CHUNK_LENGTH;

        strip.position.set(xPos, -2.1, zPos);
        mountainChunks.push(strip);
      }
    }

    return mountainChunks;
  }, []);

  const chunksRef = useRef(chunks);

  useFrame((state, delta) => {
    chunksRef.current.forEach((chunk) => {
      chunk.position.z += WORLD_CONFIG.SPEED * delta;

      // Reset when fully behind camera
      // Camera Z is ~12. Chunk extends +/- 100 from center.
      // So center needs to be > 112 to be fully clear.
      // Let's use 150 to be safe and allow smooth recycling.
      if (chunk.position.z > 150) {
        chunk.position.z -= NUM_CHUNKS * CHUNK_LENGTH;
      }
    });
  });

  return (
    <>
      {chunks.map((chunk, index) => (
        <primitive key={index} object={chunk} />
      ))}
    </>
  );
};
