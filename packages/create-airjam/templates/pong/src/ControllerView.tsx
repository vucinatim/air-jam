import { ControllerShell, useAirJamController } from "@air-jam/sdk";
import { useEffect, useRef, useState } from "react";

const TEAM1_COLOR = "#f97316"; // Solaris (Orange)
const TEAM2_COLOR = "#38bdf8"; // Nebulon (Blue)

export function ControllerView() {
  const controller = useAirJamController();
  const directionRef = useRef(0);
  const [selectedTeam, setSelectedTeam] = useState<"team1" | "team2">("team1");

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

  const isPaused = controller.gameState === "paused";

  return (
    <div className="dark">
      <ControllerShell
        connectionStatus={controller.connectionStatus}
        roomId={controller.roomId}
        requiredOrientation="portrait"
        gameState={controller.gameState}
        onTogglePlayPause={() => controller.sendSystemCommand("toggle_pause")}
        onReconnect={() => controller.reconnect()}
        onRefresh={() => window.location.reload()}
      >
        {isPaused ? (
          // Team selection UI
          <div className="flex h-full w-full flex-col gap-2 p-2">
            {/* Up button - Select Team 1 */}
            <button
              type="button"
              className={`flex-1 touch-none rounded-xl text-4xl font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-95 ${
                selectedTeam === "team1"
                  ? "ring-4 ring-white ring-offset-2 ring-offset-zinc-900"
                  : "opacity-70"
              }`}
              style={{
                backgroundColor:
                  selectedTeam === "team1" ? TEAM1_COLOR : "#3f3f46",
              }}
              onTouchStart={() => setSelectedTeam("team1")}
              onMouseDown={() => setSelectedTeam("team1")}
            >
              SOLARIS
            </button>

            {/* Down button - Select Team 2 */}
            <button
              type="button"
              className={`flex-1 touch-none rounded-xl text-4xl font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-95 ${
                selectedTeam === "team2"
                  ? "ring-4 ring-white ring-offset-2 ring-offset-zinc-900"
                  : "opacity-70"
              }`}
              style={{
                backgroundColor:
                  selectedTeam === "team2" ? TEAM2_COLOR : "#3f3f46",
              }}
              onTouchStart={() => setSelectedTeam("team2")}
              onMouseDown={() => setSelectedTeam("team2")}
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
              className="flex-1 touch-none rounded-xl bg-zinc-800 text-4xl font-bold text-white shadow-lg transition-all hover:bg-zinc-700 active:scale-95 active:bg-zinc-700"
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
              className="flex-1 touch-none rounded-xl bg-zinc-800 text-4xl font-bold text-white shadow-lg transition-all hover:bg-zinc-700 active:scale-95 active:bg-zinc-700"
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
