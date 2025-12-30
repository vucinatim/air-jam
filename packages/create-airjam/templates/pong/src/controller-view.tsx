import {
  AirJamDebug,
  ControllerShell,
  useAirJamController,
} from "@air-jam/sdk";
import { useEffect, useRef } from "react";
import { usePongStore, type PongState } from "./store";

const TEAM1_COLOR = "#f97316"; // Solaris (Orange)
const TEAM2_COLOR = "#38bdf8"; // Nebulon (Blue)

export function ControllerView() {
  const controller = useAirJamController();
  const directionRef = useRef(0);

  // Use the networked store
  const teamAssignments = usePongStore(
    (state: PongState) => state.teamAssignments,
  );
  const actions = usePongStore((state: PongState) => state.actions);

  const myAssignment = controller.controllerId
    ? teamAssignments[controller.controllerId]
    : null;
  const myTeam = myAssignment?.team ?? null;

  // Send input loop (only when playing)
  useEffect(() => {
    if (controller.connectionStatus !== "connected") return;
    if (controller.gameState !== "playing") return;

    let animationId: number;
    const loop = () => {
      controller.sendInput({
        direction: directionRef.current,
        action: false,
      });
      console.log("directionRef.current", directionRef.current);
      animationId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationId);
  }, [controller.connectionStatus, controller.gameState, controller]);

  return (
    <div className="relative bg-black">
      <ControllerShell
        connectionStatus={controller.connectionStatus}
        roomId={controller.roomId}
        forceOrientation="portrait"
        gameState={controller.gameState}
        onTogglePlayPause={() => controller.sendSystemCommand("toggle_pause")}
        onReconnect={() => controller.reconnect()}
        onRefresh={() => window.location.reload()}
      >
        {/* Debug State Component */}
        <div className="absolute top-5 right-5 z-50">
          <AirJamDebug
            state={usePongStore((state: PongState) => state)}
            title="Pong Game State"
          />
        </div>
        {controller.gameState === "paused" ? (
          // Team selection UI (shown when paused)
          <div className="flex h-full w-full flex-col gap-2 p-2">
            {/* Up button - Select Team 1 */}
            <button
              type="button"
              className={`flex-1 touch-none rounded-xl text-4xl font-bold text-white shadow-lg select-none hover:opacity-90 active:scale-95 ${
                myTeam === "team1"
                  ? "ring-4 ring-white ring-offset-2 ring-offset-zinc-900"
                  : "opacity-70"
              }`}
              style={{
                backgroundColor: myTeam === "team1" ? TEAM1_COLOR : "#3f3f46",
                willChange: "transform",
                transition: "none",
              }}
              onTouchStart={() => actions.joinTeam("team1")}
              onMouseDown={() => actions.joinTeam("team1")}
            >
              SOLARIS
            </button>

            {/* Down button - Select Team 2 */}
            <button
              type="button"
              className={`flex-1 touch-none rounded-xl text-4xl font-bold text-white shadow-lg select-none hover:opacity-90 active:scale-95 ${
                myTeam === "team2"
                  ? "ring-4 ring-white ring-offset-2 ring-offset-zinc-900"
                  : "opacity-70"
              }`}
              style={{
                backgroundColor: myTeam === "team2" ? TEAM2_COLOR : "#3f3f46",
                willChange: "transform",
                transition: "none",
              }}
              onTouchStart={() => actions.joinTeam("team2")}
              onMouseDown={() => actions.joinTeam("team2")}
            >
              NEBULON
            </button>
          </div>
        ) : (
          // Game control buttons
          <div className="flex h-full w-full flex-col gap-2 p-2">
            {/* Up button */}
            <button
              type="button"
              className="flex-1 touch-none rounded-xl bg-zinc-800 text-4xl font-bold text-white shadow-lg select-none hover:bg-zinc-700 active:scale-95 active:bg-zinc-700"
              style={{
                willChange: "transform",
                transition: "none",
              }}
              onTouchStart={() => (directionRef.current = -1)}
              onTouchEnd={() => (directionRef.current = 0)}
              onMouseDown={() => (directionRef.current = -1)}
              onMouseUp={() => (directionRef.current = 0)}
            >
              ▲ UP
            </button>

            {/* Down button */}
            <button
              type="button"
              className="flex-1 touch-none rounded-xl bg-zinc-800 text-4xl font-bold text-white shadow-lg select-none hover:bg-zinc-700 active:scale-95 active:bg-zinc-700"
              style={{
                willChange: "transform",
                transition: "none",
              }}
              onTouchStart={() => (directionRef.current = 1)}
              onTouchEnd={() => (directionRef.current = 0)}
              onMouseDown={() => (directionRef.current = 1)}
              onMouseUp={() => (directionRef.current = 0)}
            >
              ▼ DOWN
            </button>
          </div>
        )}
      </ControllerShell>
    </div>
  );
}
