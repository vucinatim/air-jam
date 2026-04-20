/**
 * Controller surface for pong. The exported view mounts the game audio
 * runtime; the private controller child renders the phone UI beneath that
 * provider. Game panels read SDK/session and replicated store state directly.
 */
import { AudioRuntime, useControllerToasts } from "@air-jam/sdk";
import { SurfaceViewport } from "@air-jam/sdk/ui";
import { PONG_SOUND_MANIFEST } from "../game/sounds";
import { usePongStore } from "../game/stores";
import { ControllerHeader } from "./components/controller-header";
import { EndedPanel } from "./components/ended-panel";
import { LobbyPanel } from "./components/lobby-panel";
import { PlayingControls } from "./components/playing-controls";
import { useControllerConnectionNotice } from "./use-controller-connection-notice";
import { usePongControllerInputRuntime } from "./use-pong-controller-input-runtime";

export function ControllerView() {
  return (
    <AudioRuntime manifest={PONG_SOUND_MANIFEST}>
      <PongController />
    </AudioRuntime>
  );
}

function PongController() {
  const matchPhase = usePongStore((state) => state.matchPhase);
  const { latestToast } = useControllerToasts();
  const { controlsDisabled, connectionNotice } =
    useControllerConnectionNotice();
  const inputRuntime = usePongControllerInputRuntime({
    controlsDisabled,
  });

  return (
    <SurfaceViewport orientation="portrait" className="bg-zinc-950">
      <div className="pong-controller-shell pong-safe-screen flex h-full min-h-0 w-full flex-col text-white">
        <ControllerHeader />

        {connectionNotice ? (
          <div className="rounded-b-xl border-b border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[0.6875rem] font-semibold tracking-[0.12em] text-amber-100 uppercase">
            {connectionNotice}
          </div>
        ) : null}
        {latestToast ? (
          <div
            className="rounded-b-xl border-b px-3 py-2 text-[0.6875rem] font-semibold tracking-[0.12em] uppercase"
            style={{
              borderColor: `${latestToast.color ?? "#38bdf8"}55`,
              backgroundColor: `${latestToast.color ?? "#38bdf8"}1a`,
              color: latestToast.color ?? "#bae6fd",
            }}
          >
            {latestToast.message}
          </div>
        ) : null}

        {matchPhase === "lobby" ? (
          <LobbyPanel />
        ) : matchPhase === "ended" ? (
          <EndedPanel />
        ) : (
          <PlayingControls onDirectionChange={inputRuntime.setDirection} />
        )}
      </div>
    </SurfaceViewport>
  );
}
