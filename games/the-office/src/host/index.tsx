/**
 * Host surface for the-office.
 *
 * Office-themed co-op: each controller adopts a "player" persona with its
 * own capabilities, and they cooperate on pending tasks that appear in
 * `TaskSidebar`. `GameCanvas` renders the 2D office floor; the rest of the
 * host is just chrome over the networked `useSpaceStore` state plus the
 * match-clock / pending-task hooks in `./hooks/use-office-game-runtime`.
 */
import { AudioRuntime, useHostAudioMutePreference } from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import { HostMuteButton, SurfaceViewport } from "@air-jam/sdk/ui";
import { OFFICE_SOUND_MANIFEST } from "../game/contracts/sounds";
import { OfficeHostGameplaySurface } from "./components/host-gameplay-surface";
import { OfficeHostOverlays } from "./components/host-overlays";
import { OfficeHostPlayerStrip } from "./components/host-player-strip";
import { OfficeHostTopHud } from "./components/host-top-hud";
import { useOfficeActiveMatchClock } from "./hooks/use-office-game-runtime";
import { useOfficeHostSession } from "./hooks/use-office-host-session";

export function HostView() {
  return (
    <AudioRuntime manifest={OFFICE_SOUND_MANIFEST}>
      <OfficeHostScreen />
    </AudioRuntime>
  );
}

function OfficeHostScreen() {
  const session = useOfficeHostSession();
  const audioPreference = useHostAudioMutePreference("the-office");
  const matchClock = useOfficeActiveMatchClock();

  return (
    <>
      <SurfaceViewport className="bg-[#fdf6e3]">
        <div className="relative flex h-full w-full flex-col overflow-hidden p-2">
          <OfficeHostTopHud timeRemainingMs={matchClock.timeRemainingMs} />
          <OfficeHostGameplaySurface
            muted={audioPreference.muted}
            session={session}
            matchClock={matchClock}
          />
          <OfficeHostPlayerStrip />
          <OfficeHostOverlays session={session} />
        </div>
      </SurfaceViewport>
      <HostPreviewControllerWorkspace
        dockAccessory={
          <HostMuteButton
            muted={audioPreference.muted}
            onToggle={audioPreference.toggleMuted}
          />
        }
      />
    </>
  );
}
