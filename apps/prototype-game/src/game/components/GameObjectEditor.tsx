import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { FlagModel } from "./FlagModel";
import { RocketModel } from "./RocketModel";
import { ShipModel } from "./ShipModel";

interface GameObjectEditorProps {
  objectType: "rocket" | "laser" | "ship" | "collectible" | "flag";
}

type ModelType = "rocket" | "ship" | "flag";

function EditorScene({
  modelType,
  offset,
}: {
  modelType: ModelType;
  offset: [number, number, number];
}) {
  // Refs for ShipModel (needed for preview)
  const thrustRef = useRef(0.5);
  const thrustInputRef = useRef(0.5);
  const planeGroupRef = useRef<THREE.Group | null>(null);

  // Animate thrust for preview (simple sine wave)
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    // Animate thrust between 0.3 and 1.0 for visual effect
    thrustRef.current = 0.3 + Math.sin(time * 0.5) * 0.35 + 0.35;
    thrustInputRef.current = 0.5; // Neutral input for preview
  });

  return (
    <>
      {/* Scene settings */}
      <color args={[0x1a1a1f]} attach="background" />
      <fogExp2 args={[0x1a1a1f, 0.01]} />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-5, 5, -5]} intensity={0.5} />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial
          color={0x2a2a2f}
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      {/* Grid helper */}
      <gridHelper args={[20, 20, 0x444444, 0x333333]} />

      {/* Object preview */}
      {modelType === "rocket" && (
        <group position={offset}>
          <RocketModel showParticles={true} horizontal={false} />
        </group>
      )}
      {modelType === "ship" && (
        <group position={offset}>
          <ShipModel
            playerColor="#38bdf8"
            thrustRef={thrustRef}
            thrustInputRef={thrustInputRef}
            abilityVisual={null}
            planeGroupRef={planeGroupRef}
          />
        </group>
      )}
      {modelType === "flag" && (
        <group position={offset}>
          <FlagModel color="#f97316" animate={true} />
        </group>
      )}

      {/* Orbit Controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={20}
        target={offset}
      />
    </>
  );
}

export function GameObjectEditor({ objectType }: GameObjectEditorProps) {
  const [offset, setOffset] = useState<[number, number, number]>([0, 1.5, 0]);
  const [modelType, setModelType] = useState<ModelType>(
    objectType === "flag" ? "flag" : "rocket",
  );

  return (
    <div className="flex h-full w-full flex-col">
      {/* Controls panel */}
      <div className="border-b border-gray-700 bg-gray-800 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Model Type Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-white">Model:</label>
            <select
              value={modelType}
              onChange={(e) => setModelType(e.target.value as ModelType)}
              className="rounded border border-gray-600 bg-gray-700 px-3 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="rocket">Rocket</option>
              <option value="ship">Ship</option>
              <option value="flag">Flag</option>
            </select>
          </div>
          <label className="text-sm font-medium text-white">Offset:</label>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-300">X:</label>
            <input
              type="number"
              value={offset[0]}
              onChange={(e) =>
                setOffset([
                  parseFloat(e.target.value) || 0,
                  offset[1],
                  offset[2],
                ])
              }
              step="0.1"
              className="w-20 rounded bg-gray-700 px-2 py-1 text-sm text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-300">Y:</label>
            <input
              type="number"
              value={offset[1]}
              onChange={(e) =>
                setOffset([
                  offset[0],
                  parseFloat(e.target.value) || 0,
                  offset[2],
                ])
              }
              step="0.1"
              className="w-20 rounded bg-gray-700 px-2 py-1 text-sm text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-300">Z:</label>
            <input
              type="number"
              value={offset[2]}
              onChange={(e) =>
                setOffset([
                  offset[0],
                  offset[1],
                  parseFloat(e.target.value) || 0,
                ])
              }
              step="0.1"
              className="w-20 rounded bg-gray-700 px-2 py-1 text-sm text-white"
            />
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <Canvas shadows gl={{ antialias: true }}>
          <EditorScene modelType={modelType} offset={offset} />
        </Canvas>
      </div>
    </div>
  );
}
