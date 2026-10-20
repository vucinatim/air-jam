/**
 * Host surface for pong. The match itself is the declared simulation the SDK
 * steps (see game/engine/pong-simulation.ts); this surface draws it, plays its
 * feedback and shows the lobby, match and results screens.
 */
import {
  AudioRuntime,
  captureAgentCanvas,
  useAirJamHost,
  useAirJamStore,
  useHostAgentCapture,
  useSimulationEvents,
  useSimulationFrame,
} from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import { SurfaceViewport } from "@air-jam/sdk/ui";
import { PONG_SOUND_MANIFEST } from "../game/contracts/sounds";
import {
  drawFrame,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  updateRuntimeRenderState,
  type PongSimulationEvent,
  type PongSimulationState,
} from "../game/engine";
import { pongStore } from "../game/stores";
import { EndedScreen } from "./components/ended-screen";
import { LobbyScreen } from "./components/lobby-screen";
import { PlayingScreen } from "./components/playing-screen";
import { usePongCanvas } from "./hooks/use-pong-canvas";
import { usePongFeedback } from "./hooks/use-pong-feedback";

export function HostView() {
  return (
    <AudioRuntime manifest={PONG_SOUND_MANIFEST}>
      <PongHost />
    </AudioRuntime>
  );
}

function PongHost() {
  const players = useAirJamHost((state) => state.players);
  const matchPhase = useAirJamStore(pongStore, (state) => state.matchPhase);
  const teamAssignments = useAirJamStore(
    pongStore,
    (state) => state.teamAssignments,
  );
  const botCounts = useAirJamStore(pongStore, (state) => state.botCounts);

  const { triggerPaddleHitFeedback, triggerScoreFeedback } = usePongFeedback();
  const { canvasRef, getContext } = usePongCanvas({
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
  });

  useSimulationEvents<PongSimulationEvent>((event) => {
    if (event.type === "paddle-hit") triggerPaddleHitFeedback(event);
    else triggerScoreFeedback();
  });

  useHostAgentCapture(() => captureAgentCanvas(getContext()?.canvas ?? null));

  useSimulationFrame<PongSimulationState>(({ sim, alpha }) => {
    const ctx = getContext();
    if (!ctx) return;
    drawFrame({
      ctx,
      state: updateRuntimeRenderState(sim.buffers, alpha),
      players,
      teamAssignments,
      countdown: sim.countdown,
      botCounts,
    });
  });

  return (
    <>
      {/* Host tokens scale to a 1600×900 reference; in a small embedded host
          (e.g. 715×626) that made body text ~6px. A floor keeps scores and
          captions readable; the screens scroll or stack when content grows. */}
      <SurfaceViewport className="bg-[#02030a]" minScale={0.8}>
        {matchPhase === "lobby" ? (
          <LobbyScreen />
        ) : matchPhase === "ended" ? (
          <EndedScreen />
        ) : (
          <PlayingScreen canvasRef={canvasRef} />
        )}
      </SurfaceViewport>
      <HostPreviewControllerWorkspace />
    </>
  );
}
