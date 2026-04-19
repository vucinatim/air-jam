/**
 * Host surface. Renders on the TV / laptop / big screen.
 *
 * Flow:
 *  1. `useAirJamHost()` gives us the live session: room id, join url, connected
 *     players.
 *  2. `useMinimalStore` pulls the replicated game state (shared count,
 *     per-player counts).
 *  3. The join URL + QR code are shown so phones can scan to join.
 *  4. When controllers tap, the store action runs here on the host, the count
 *     updates, and the new state is broadcast back to every controller.
 *  5. The "Reset" button dispatches `actions.reset()` as a host-originated
 *     action — same action pipeline, no special casing.
 *
 * No game loop, no input reading, no side effects — a counter doesn't need
 * any of that. See `pong` for a host that drives a 60fps simulation.
 */
import { useAirJamHost } from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import { RoomQrCode, SurfaceViewport } from "@air-jam/sdk/ui";
import { useMinimalStore } from "../game/store";

export function HostView() {
  const host = useAirJamHost();
  const totalCount = useMinimalStore((state) => state.totalCount);
  const actions = useMinimalStore.useActions();

  return (
    <>
      <SurfaceViewport className="bg-neutral-950">
        <div className="flex h-full w-full flex-col items-center justify-center gap-10 p-8 text-white">
          <div className="text-xs tracking-[0.3em] text-neutral-500 uppercase">
            Shared Taps
          </div>

          <div className="text-[22vmin] leading-none font-black tabular-nums">
            {totalCount}
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="text-xs tracking-[0.2em] text-neutral-400 uppercase">
              Scan to join
            </div>
            {host.joinUrl ? (
              <RoomQrCode value={host.joinUrl} size={180} />
            ) : (
              <div className="text-sm text-neutral-500">Connecting…</div>
            )}
            <div className="text-xs text-neutral-500">
              Room: {host.roomId ?? "—"} · {host.players.length} connected
            </div>
          </div>

          <button
            type="button"
            onClick={() => actions.reset()}
            className="rounded-full border border-neutral-700 bg-neutral-900 px-6 py-2 text-xs font-semibold tracking-[0.2em] text-neutral-300 uppercase hover:bg-neutral-800"
          >
            Reset
          </button>
        </div>
      </SurfaceViewport>
      <HostPreviewControllerWorkspace />
    </>
  );
}
