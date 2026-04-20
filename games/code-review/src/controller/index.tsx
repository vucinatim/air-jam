import { useAirJamController } from "@air-jam/sdk";
import { ControllerPlayerNameField, SurfaceViewport } from "@air-jam/sdk/ui";
import { useGameStore } from "../game/stores";
import { ControllerHeader } from "./components/controller-header";
import { EndedPanel } from "./components/ended-panel";
import { LobbyPanel } from "./components/lobby-panel";
import { PausedPanel } from "./components/paused-panel";
import { PlayingControls } from "./components/playing-controls";
import { useCodeReviewControllerInput } from "./hooks/use-code-review-controller-input";

export function ControllerView() {
  const controller = useAirJamController();
  const matchPhase = useGameStore((state) => state.matchPhase);

  const canUseGameplayControls =
    controller.connectionStatus === "connected" &&
    matchPhase === "playing" &&
    controller.runtimeState === "playing";
  const desiredOrientation =
    matchPhase === "playing" ? "landscape" : "portrait";
  const {
    requestPermissions,
    startDefending,
    stopDefending,
    triggerLeftPunch,
    triggerRightPunch,
  } = useCodeReviewControllerInput({
    enabled: canUseGameplayControls,
  });

  return (
    <div className="controller-view-shell">
      <SurfaceViewport orientation={desiredOrientation}>
        <div className="pixel-font flex h-full w-full flex-col">
          <ControllerHeader />

          {matchPhase === "lobby" ? (
            <ControllerPlayerNameField
              className="border-b-4 border-zinc-800 bg-zinc-950 px-3 py-2"
              labelClassName="text-[9px] font-black tracking-[0.2em] text-zinc-500 uppercase"
              inputClassName="pixel-font w-full rounded-none border-4 border-zinc-600 bg-black px-2 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-400"
            />
          ) : null}

          {matchPhase === "ended" ? (
            <EndedPanel />
          ) : matchPhase === "lobby" ? (
            <LobbyPanel
              onRequestPermissions={() => {
                void requestPermissions();
              }}
            />
          ) : canUseGameplayControls ? (
            <PlayingControls
              onLeftPunch={triggerLeftPunch}
              onRightPunch={triggerRightPunch}
              onDefendStart={startDefending}
              onDefendEnd={stopDefending}
            />
          ) : (
            <PausedPanel />
          )}
        </div>
      </SurfaceViewport>
    </div>
  );
}
