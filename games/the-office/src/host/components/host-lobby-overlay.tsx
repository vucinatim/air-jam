import { useAirJamStore } from "@air-jam/sdk";
import {
  JoinQrOverlay,
  JoinUrlControls,
  LifecycleActionGroup,
} from "@air-jam/sdk/ui";
import {
  getPlayerById,
  getPlayerCapabilityHighlights,
} from "../../game/content/players";
import { spaceStore } from "../../game/stores";
import type { OfficeHostSession } from "../hooks/use-office-host-session";

export function OfficeHostLobbyOverlay({
  session,
}: {
  session: OfficeHostSession;
}) {
  const taskDurationMs = useAirJamStore(
    spaceStore,
    (state) => state.taskDurationMs,
  );
  const playerAssignments = useAirJamStore(
    spaceStore,
    (state) => state.playerAssignments,
  );
  const {
    roomId,
    players,
    selectedCount,
    canStartMatch,
    joinControls,
    startMatch,
  } = session;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--airjam-color-text-dark)]/70 p-4">
      <div className="w-full max-w-2xl border border-[var(--airjam-color-paper-pale-gold)] bg-[var(--airjam-color-paper-pale-gold)] p-6 text-[var(--airjam-color-text-paper)] shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-[var(--airjam-color-button)] uppercase">
              Room
            </p>
            <p className="text-xl font-bold">{roomId ?? "----"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-[0.2em] text-[var(--airjam-color-button)] uppercase">
              Picked
            </p>
            <p className="text-xl font-bold">
              {selectedCount}/{players.length}
            </p>
          </div>
        </div>

        <div className="mb-4 w-full">
          <JoinUrlControls
            value={joinControls.joinUrlValue}
            label={
              <span className="text-xs tracking-[0.2em] text-[var(--airjam-color-button)] uppercase">
                Controller link
              </span>
            }
            copied={joinControls.copied}
            onCopy={joinControls.handleCopy}
            onOpen={joinControls.handleOpen}
            qrVisible={joinControls.joinQrVisible}
            onToggleQr={joinControls.toggleJoinQr}
            inputClassName="border-[var(--airjam-color-border-light)] bg-[var(--airjam-color-paper)] text-[var(--airjam-color-text-paper)] placeholder:text-[var(--airjam-color-button)]/70"
            buttonClassName="rounded-none border-[var(--airjam-color-button)]/25 bg-[var(--airjam-color-button)] text-[var(--airjam-color-paper-cream)] hover:bg-[var(--airjam-color-button-hover)]"
          />
        </div>

        <div className="mb-4 max-h-64 overflow-y-auto border border-[var(--airjam-color-border-light)] bg-[var(--airjam-color-paper)] p-3">
          {players.length === 0 ? (
            <p className="text-sm text-[var(--airjam-color-text-gray)]">
              Waiting for controllers to join…
            </p>
          ) : (
            <ul className="space-y-2">
              {players.map((player) => {
                const selectedCharacterId = playerAssignments[player.id];
                const selectedCharacter = selectedCharacterId
                  ? getPlayerById(selectedCharacterId)
                  : null;
                const highlights = selectedCharacterId
                  ? getPlayerCapabilityHighlights(
                      selectedCharacterId,
                      taskDurationMs,
                      2,
                    )
                  : [];

                return (
                  <li
                    key={player.id}
                    className="border-b border-[var(--airjam-color-border-light)] pb-2 text-sm last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{player.label}</p>
                        <p className="text-xs text-[var(--airjam-color-button)]">
                          {selectedCharacter
                            ? selectedCharacter.name
                            : "No character selected"}
                        </p>
                      </div>
                      <span className="font-semibold">
                        {selectedCharacter ? "Selected" : "Unselected"}
                      </span>
                    </div>
                    {selectedCharacter ? (
                      <div className="mt-2 flex items-start gap-2">
                        <img
                          src={selectedCharacter.image}
                          alt={selectedCharacter.name}
                          className="h-10 w-10 rounded object-cover object-top"
                        />
                        <div className="space-y-1 text-[11px] text-[var(--airjam-color-text-paper)]">
                          {highlights.map((highlight) => (
                            <p
                              key={`${selectedCharacter.id}:${highlight.taskId}`}
                            >
                              {highlight.label}: {highlight.level}/5 •{" "}
                              {(highlight.durationMs / 1000).toFixed(0)}s
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <LifecycleActionGroup
          phase="lobby"
          canInteract={canStartMatch}
          onStart={startMatch}
          startLabel="Start Match"
          className="justify-center"
          buttonClassName="rounded-none border-[var(--airjam-color-button)]/25 bg-[var(--airjam-color-button)] px-5 text-[var(--airjam-color-paper-cream)] hover:bg-[var(--airjam-color-button-hover)]"
        />
        <JoinQrOverlay
          open={joinControls.joinQrVisible}
          value={joinControls.joinUrlValue}
          roomId={roomId}
          onClose={joinControls.hideJoinQr}
          description="Scan with your phone to join The Office as a controller."
        />
      </div>
    </div>
  );
}
