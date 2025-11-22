import { useFrame } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { type MutableRefObject, type RefObject } from "react";
import type { InputState } from "../game-store";
import { usePhysicsStore } from "../physics-store";

export interface PhysicsFrame {
  timestamp: number;
  input: { x: number; y: number };
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
  smoothedInput: { x: number; y: number };
  velocityChange: { x: number; y: number; z: number }; // Velocity delta per frame (velocity-based system)
  angularVelocityChange: { x: number; y: number; z: number }; // Angular velocity delta per frame
}

export interface PhysicsDebugData {
  smoothedInput: { x: number; y: number };
  velocityChange: { x: number; y: number; z: number }; // Velocity delta per frame
  angularVelocityChange: { x: number; y: number; z: number }; // Angular velocity delta per frame
}

interface PhysicsRecorderProps {
  rigidBodyRef: RefObject<RapierRigidBody>;
  inputRef: MutableRefObject<InputState>;
  debugDataRef: MutableRefObject<PhysicsDebugData>;
}

export function PhysicsRecorder({
  rigidBodyRef,
  inputRef,
  debugDataRef,
}: PhysicsRecorderProps) {
  const isRecording = usePhysicsStore((state) => state.isRecording);
  const addFrame = usePhysicsStore((state) => state.addFrame);

  useFrame((state) => {
    if (!isRecording || !rigidBodyRef.current || !inputRef.current) return;

    // Record every frame for accurate physics analysis
    const body = rigidBodyRef.current;
    const input = inputRef.current;
    const pos = body.translation();
    const vel = body.linvel();
    const angVel = body.angvel();

    addFrame({
      timestamp: state.clock.elapsedTime,
      input: { x: input.vector.x, y: input.vector.y },
      position: { x: pos.x, y: pos.y, z: pos.z },
      velocity: { x: vel.x, y: vel.y, z: vel.z },
      angularVelocity: { x: angVel.x, y: angVel.y, z: angVel.z },
      smoothedInput: debugDataRef.current.smoothedInput,
      velocityChange: debugDataRef.current.velocityChange,
      angularVelocityChange: debugDataRef.current.angularVelocityChange,
    });
  });

  return null;
}
