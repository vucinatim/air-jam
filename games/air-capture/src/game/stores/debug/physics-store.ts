import { create } from "zustand";

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

interface PhysicsStore {
  isRecording: boolean;
  recordedFrames: PhysicsFrame[];
  startRecording: () => void;
  stopRecording: () => void;
  addFrame: (frame: PhysicsFrame) => void;
  clearFrames: () => void;
}

export const usePhysicsStore = create<PhysicsStore>((set) => ({
  isRecording: false,
  recordedFrames: [],
  startRecording: () => set({ isRecording: true, recordedFrames: [] }),
  stopRecording: () => set({ isRecording: false }),
  addFrame: (frame) =>
    set((state) => ({ recordedFrames: [...state.recordedFrames, frame] })),
  clearFrames: () => set({ recordedFrames: [] }),
}));
