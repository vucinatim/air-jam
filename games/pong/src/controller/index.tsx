/**
 * Controller surface for pong. The binding supplies audio; game panels read
 * SDK/session and replicated store state directly.
 */
import { useAirJamStore, useControllerToasts } from "@air-jam/sdk";
import { SurfaceViewport } from "@air-jam/sdk/ui";
import { pongStore } from "../game/stores";
import { pongTheme } from "../game/theme";
import { ControllerHeader } from "./components/controller-header";
import { EndedPanel } from "./components/ended-panel";
import { LobbyPanel } from "./components/lobby-panel";
import { PlayingControls } from "./components/playing-controls";
import { useControllerConnectionNotice } from "./hooks/use-controller-connection-notice";

export function ControllerView() {
  const matchPhase = useAirJamStore(pongStore, (state) => state.matchPhase);
  const { latestToast } = useControllerToasts();
  const { connectionNotice } = useControllerConnectionNotice();

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
              borderColor: `${latestToast.color ?? pongTheme.colors.team2}55`,
              backgroundColor: `${latestToast.color ?? pongTheme.colors.team2}1a`,
              color: latestToast.color ?? pongTheme.colors.controllerAccent,
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
          <PlayingControls />
        )}
      </div>
    </SurfaceViewport>
  );
}
