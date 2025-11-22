import { create } from "zustand";
import type { PhysicsFrame } from "./components/PhysicsRecorder";

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
