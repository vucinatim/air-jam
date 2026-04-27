import type { OfficeHostSession } from "../hooks/use-office-host-session";
import { OfficeHostEndedOverlay } from "./host-ended-overlay";
import { OfficeHostLobbyOverlay } from "./host-lobby-overlay";
import { OfficeHostPausedOverlay } from "./host-paused-overlay";

export function OfficeHostOverlays({
  session,
}: {
  session: OfficeHostSession;
}) {
  if (session.matchPhase === "lobby") {
    return <OfficeHostLobbyOverlay session={session} />;
  }

  if (session.matchPhase === "ended") {
    return <OfficeHostEndedOverlay onReturnToLobby={session.returnToLobby} />;
  }

  if (session.matchPhase === "playing" && session.runtimeState !== "playing") {
    return <OfficeHostPausedOverlay />;
  }

  return null;
}
