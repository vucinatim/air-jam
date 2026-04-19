/**
 * Controller surface. Renders on each connected phone.
 *
 * Flow:
 *  1. `useAirJamController()` gives us the session identity and connection
 *     status.
 *  2. `useMinimalStore` reads the replicated game state. `actions.tap()` is
 *     the star of the show — calling it on the controller RPCs the action to
 *     the host, which runs the reducer and broadcasts the new state back.
 *  3. `useSendSignal()` lets the host trigger haptics / toasts on a specific
 *     controller. We use it here the other way round — the controller
 *     triggers its *own* haptic on tap, so the tap feels physical even
 *     before the round-trip completes.
 *
 * No input writer, no tick loop — taps are discrete events, not per-frame
 * intent. See `pong` for the input-lane pattern.
 */
import { useAirJamController, useSendSignal } from "@air-jam/sdk";
import { SurfaceViewport } from "@air-jam/sdk/ui";
import { useMinimalStore } from "../game/store";

export function ControllerView() {
  const controller = useAirJamController();
  const sendSignal = useSendSignal();
  const actions = useMinimalStore.useActions();

  const myControllerId = controller.controllerId;
  const myCount = useMinimalStore((state) =>
    myControllerId ? (state.perPlayerCounts[myControllerId] ?? 0) : 0,
  );
  const totalCount = useMinimalStore((state) => state.totalCount);

  const canTap = controller.connectionStatus === "connected";

  const handleTap = () => {
    if (!canTap) return;
    actions.tap();
    // Self-targeted haptic: gives the tap physical feedback the instant it's
    // pressed, independent of network latency. The server forwards this back
    // to the same controller because `target` matches the caller.
    if (controller.controllerId) {
      sendSignal("HAPTIC", { pattern: "light" }, controller.controllerId);
    }
  };

  return (
    <SurfaceViewport orientation="portrait" className="bg-neutral-950">
      <div className="flex h-full w-full flex-col items-center justify-between gap-4 p-6 text-white">
        <div className="w-full text-center">
          <div className="text-[0.625rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
            Room {controller.roomId ?? "—"}
          </div>
          <div className="mt-1 text-xs text-neutral-400">
            {controller.connectionStatus === "connected"
              ? "Connected — tap away"
              : `Status: ${controller.connectionStatus}`}
          </div>
        </div>

        <button
          type="button"
          onPointerDown={handleTap}
          disabled={!canTap}
          className="flex h-[50vmin] w-[50vmin] items-center justify-center rounded-full bg-emerald-500 text-4xl font-black tracking-[0.1em] text-emerald-950 uppercase shadow-lg shadow-emerald-500/30 transition active:scale-95 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:shadow-none"
        >
          Tap
        </button>

        <div className="flex w-full items-baseline justify-between text-sm">
          <span className="text-neutral-400">
            Your taps:{" "}
            <span className="font-bold text-white tabular-nums">{myCount}</span>
          </span>
          <span className="text-neutral-400">
            Total:{" "}
            <span className="font-bold text-white tabular-nums">
              {totalCount}
            </span>
          </span>
        </div>
      </div>
    </SurfaceViewport>
  );
}
