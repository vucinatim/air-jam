import {
  Button,
  ControllerShell,
  PlaySoundPayload,
  useAirJamController,
  useAudio,
} from "@air-jam/sdk";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { createControllerStore } from "../game/controller-store";
import { SOUND_MANIFEST } from "../game/sounds";

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
  const audio = useAudio(SOUND_MANIFEST);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();

    // Initialize audio context on first interaction
    audio.init();
    audio.play("click");

    const currentVector = store.getState().vector;
    store.getState().setVector({ ...currentVector, [axis]: value });
    vibrate(10);
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
      className={`h-full flex-1 touch-none rounded-xl bg-slate-800 text-4xl font-semibold text-slate-100 shadow-lg transition-transform hover:bg-slate-700 sm:text-5xl md:text-6xl ${
        isActive ? "scale-95 bg-slate-700 ring-2 ring-slate-500" : ""
      }`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={(e) => e.preventDefault()}
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
  const audio = useAudio(SOUND_MANIFEST);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();

    audio.init();

    if (action === "ability") {
      store.getState().setAbility(true);
    } else {
      store.getState().setAction(true);
    }

    vibrate(20);
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    e.preventDefault();

    if (action === "ability") store.getState().setAbility(false);
    else store.getState().setAction(false);
  };

  return (
    <Button
      type="button"
      className={`h-full flex-1 touch-none rounded-xl border-0 text-lg font-bold text-white shadow-lg transition-transform sm:text-xl md:text-2xl ${colorClass} ${
        isActive ? `scale-95 ring-2 brightness-110 ${activeRingClass}` : ""
      }`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      <Icon className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10" />
      <span>{label}</span>
    </Button>
  );
};

// --- Main View Content ---

const ControllerContent = () => {
  const {
    roomId,
    connectionStatus,
    sendInput,
    sendSystemCommand,
    gameState,
    reconnect,
    socket,
  } = useAirJamController();
  const audio = useAudio(SOUND_MANIFEST);

  // Create a stable store instance
  const [store] = useState(() => createControllerStore());

  // Subscribe to store changes to transmit input
  useEffect(() => {
    if (connectionStatus !== "connected") return;

    const unsubscribe = store.subscribe((state) => {
      // Send arbitrary input structure - this game uses vector/action/ability
      // Other games can define their own structure
      sendInput({
        vector: state.vector,
        action: state.action,
        ability: state.ability,
        timestamp: Date.now(),
      });
    });

    return unsubscribe;
  }, [connectionStatus, sendInput, store]);

  // Listen for server sound events
  useEffect(() => {
    if (!socket) return;

    const handlePlaySound = (payload: PlaySoundPayload) => {
      // Type assertion needed since payload.id is string but audio.play expects SoundId
      audio.play(payload.id as keyof typeof SOUND_MANIFEST);
    };

    socket.on("server:playSound", (payload) => {
      console.log("[Controller] Received server:playSound event:", payload);
      if (payload.id) {
        audio.play(payload.id as keyof typeof SOUND_MANIFEST);
      }
    });

    return () => {
      socket.off("server:playSound", handlePlaySound);
    };
  }, [socket, audio]);

  // Engine sounds are now handled on host, removed from controller

  const handleTogglePlayPause = (): void => {
    if (connectionStatus !== "connected") return;

    audio.init();
    audio.play("click");
    vibrate([50, 50, 50]);

    // Use system command for pause toggle
    sendSystemCommand("toggle_pause");
  };

  const handleReconnect = (roomCode: string): void => {
    // Update URL with new room code and reload to reconnect
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode);
    window.location.href = url.toString();
  };

  const handleRefresh = (): void => {
    reconnect();
  };

  return (
    <ControllerShell
      roomId={roomId}
      connectionStatus={connectionStatus}
      requiredOrientation="landscape"
      gameState={gameState}
      onTogglePlayPause={handleTogglePlayPause}
      onReconnect={handleReconnect}
      onRefresh={handleRefresh}
    >
      <div className="flex h-full w-full touch-none items-stretch gap-2 select-none">
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
        <div className="flex flex-1 flex-col gap-2">
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
    </ControllerShell>
  );
};

// --- Main View ---

export const ControllerView = (): JSX.Element => {
  return <ControllerContent />;
};
