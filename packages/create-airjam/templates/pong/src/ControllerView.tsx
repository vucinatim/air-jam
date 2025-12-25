import { ControllerShell, useAirJamController } from "@air-jam/sdk";
import { useRef, useEffect } from "react";

export function ControllerView() {
  const controller = useAirJamController();
  const directionRef = useRef(0);

  // Send input loop
  useEffect(() => {
    if (controller.connectionStatus !== "connected") return;

    let animationId: number;
    const loop = () => {
      controller.sendInput({
        direction: directionRef.current,
        action: false,
      });
      animationId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationId);
  }, [controller.connectionStatus, controller]);

  return (
    <ControllerShell
      connectionStatus={controller.connectionStatus}
      roomId={controller.roomId}
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-gray-900 p-4">
        <h2 className="text-2xl font-bold text-white">Your Controller</h2>

        <div className="flex flex-col gap-4">
          {/* Up button */}
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-12 py-8 text-2xl font-bold text-white active:bg-blue-700"
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
            className="rounded-lg bg-blue-600 px-12 py-8 text-2xl font-bold text-white active:bg-blue-700"
            onTouchStart={() => (directionRef.current = 1)}
            onTouchEnd={() => (directionRef.current = 0)}
            onMouseDown={() => (directionRef.current = 1)}
            onMouseUp={() => (directionRef.current = 0)}
          >
            ▼ DOWN
          </button>
        </div>

        <p className="text-sm text-gray-400">
          Hold to move your paddle
        </p>
      </div>
    </ControllerShell>
  );
}
