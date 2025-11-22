import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useStore } from "zustand";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Zap,
  Target,
  type LucideIcon,
} from "lucide-react";
import { ControllerShell, useAirJamController } from "@air-jam/sdk";
import { Button } from "@air-jam/sdk";
import { createControllerStore } from "../game/controller-store";
import { soundEngine } from "../game/sound-engine";

// Helper to vibrate device if supported
const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// --- Isolated Components ---

interface DirectionControlProps {
  store: ReturnType<typeof createControllerStore>;
  axis: "x" | "y";
  value: number;
  icon: LucideIcon;
  label: string;
}

const DirectionControl = ({
  store,
  axis,
  value,
  icon: Icon,
  label,
}: DirectionControlProps) => {
  // Only re-render when this specific axis value matches our target value
  const isActive = useStore(store, (state) => state.vector[axis] === value);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    
    // Initialize audio context on first interaction
    soundEngine.init();
    soundEngine.playClick();

    const currentVector = store.getState().vector;
    store.getState().setVector({ ...currentVector, [axis]: value });
    vibrate(50);
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    e.preventDefault();
    const currentVector = store.getState().vector;
    // Only reset if we are the one currently active
    if (currentVector[axis] === value) {
      store.getState().setVector({ ...currentVector, [axis]: 0 });
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      className={`h-full flex-1 rounded-xl text-4xl sm:text-5xl md:text-6xl font-semibold shadow-lg transition-transform bg-slate-800 hover:bg-slate-700 text-slate-100 touch-none ${
        isActive ? "scale-95 bg-slate-700 ring-2 ring-slate-500" : ""
      }`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      aria-label={label}
    >
      <Icon className="h-8 w-8 sm:h-12 sm:w-12 md:h-16 md:w-16" />
    </Button>
  );
};

interface ActionControlProps {
  store: ReturnType<typeof createControllerStore>;
  action: "ability" | "action";
  icon: LucideIcon;
  label: string;
  colorClass: string;
  activeRingClass: string;
}

const ActionControl = ({
  store,
  action,
  icon: Icon,
  label,
  colorClass,
  activeRingClass,
}: ActionControlProps) => {
  const isActive = useStore(store, (state) => state[action]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    
    soundEngine.init();
    soundEngine.playHighClick(); // Higher pitch for actions

    if (action === "ability") store.getState().setAbility(true);
    else store.getState().setAction(true);
    
    vibrate(70);
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    e.preventDefault();
    
    if (action === "ability") store.getState().setAbility(false);
    else store.getState().setAction(false);
  };

  return (
    <Button
      type="button"
      className={`h-full flex-1 rounded-xl font-bold text-lg sm:text-xl md:text-2xl shadow-lg transition-transform text-white border-0 touch-none ${colorClass} ${
        isActive ? `scale-95 brightness-110 ring-2 ${activeRingClass}` : ""
      }`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      aria-label={label}
    >
      <Icon className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10" />
      <span>{label}</span>
    </Button>
  );
};

// --- Main View ---

export const ControllerView = (): JSX.Element => {
  const { roomId, connectionStatus, sendInput, gameState } =
    useAirJamController();

  // Create a stable store instance
  const [store] = useState(() => createControllerStore());

  // Subscribe to store changes to transmit input
  useEffect(() => {
    if (connectionStatus !== "connected") return;

    const unsubscribe = store.subscribe((state) => {
      sendInput({
        vector: state.vector,
        action: state.action,
        ability: state.ability,
        timestamp: Date.now(),
      });
    });

    return unsubscribe;
  }, [connectionStatus, sendInput, store]);

  const handleTogglePlayPause = (): void => {
    if (connectionStatus !== "connected") return;
    
    soundEngine.init();
    soundEngine.playHighClick();
    vibrate([50, 50, 50]);
    const state = store.getState();
    sendInput({
      vector: state.vector,
      action: state.action,
      ability: state.ability,
      timestamp: Date.now(),
      togglePlayPause: true,
    });
  };

  // Debug Haptics & Audio
  const [debugMsg, setDebugMsg] = useState("");
  const testHaptics = () => {
    if (typeof navigator === "undefined") {
      setDebugMsg("Navigator undefined");
      return;
    }
    if (typeof navigator.vibrate !== "function") {
      setDebugMsg("navigator.vibrate not supported");
      return;
    }
    const result = navigator.vibrate(200);
    setDebugMsg(`Vibrate(200): ${result}`);
  };

  const testLongHaptics = () => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
      setDebugMsg("Not supported");
      return;
    }
    const result = navigator.vibrate(1000);
    setDebugMsg(`Vibrate(1000): ${result}`);
  };

  const testAudio = () => {
    soundEngine.init();
    soundEngine.playClick();
    setDebugMsg("Playing click sound...");
  };

  return (
    <ControllerShell
      roomId={roomId}
      connectionStatus={connectionStatus}
      requiredOrientation="landscape"
      gameState={gameState}
      onTogglePlayPause={handleTogglePlayPause}
    >
      <div className="flex h-full w-full items-stretch gap-2 select-none touch-none">
        {/* Left Side - Left/Right Controls */}
        <div className="flex flex-1 items-center justify-center gap-2">
          <DirectionControl
            store={store}
            axis="x"
            value={-1}
            icon={ArrowLeft}
            label="Left"
          />
          <DirectionControl
            store={store}
            axis="x"
            value={1}
            icon={ArrowRight}
            label="Right"
          />
        </div>

        {/* Middle - Ability and Shoot Buttons */}
        <div className="flex flex-col flex-1 gap-2">
          <ActionControl
            store={store}
            action="ability"
            icon={Zap}
            label="Ability"
            colorClass="bg-linear-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            activeRingClass="ring-purple-300"
          />
          <ActionControl
            store={store}
            action="action"
            icon={Target}
            label="Shoot"
            colorClass="bg-linear-to-br from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
            activeRingClass="ring-red-300"
          />
        </div>

        {/* Right Side - Forward/Backward Controls */}
        <div className="flex flex-1 flex-col items-stretch justify-stretch gap-2">
          <DirectionControl
            store={store}
            axis="y"
            value={1}
            icon={ArrowUp}
            label="Forward"
          />
          <DirectionControl
            store={store}
            axis="y"
            value={-1}
            icon={ArrowDown}
            label="Backward"
          />
        </div>
      </div>
      
      {/* Haptic & Audio Debug Overlay */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center bg-black/50 p-2 text-xs text-white pointer-events-auto">
        <div className="flex gap-2 items-center">
           <span>Haptics: {typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? 'Supported' : 'Not Supported'}</span>
           <button onClick={testHaptics} className="bg-blue-500 px-2 py-1 rounded hover:bg-blue-600">Short Vib</button>
           <button onClick={testLongHaptics} className="bg-purple-500 px-2 py-1 rounded hover:bg-purple-600">Long Vib</button>
           <button onClick={testAudio} className="bg-green-500 px-2 py-1 rounded hover:bg-green-600">Test Snd</button>
        </div>
        {debugMsg && <div className="mt-1 text-yellow-300">{debugMsg}</div>}
      </div>
    </ControllerShell>
  );
};
