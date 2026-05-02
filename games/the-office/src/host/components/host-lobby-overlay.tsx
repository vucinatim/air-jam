import {
  JoinQrOverlay,
  JoinUrlControls,
  LifecycleActionGroup,
} from "@air-jam/sdk/ui";
import {
  getPlayerById,
  getPlayerCapabilityHighlights,
} from "../../game/content/players";
import { useSpaceStore } from "../../game/stores";
import type { OfficeHostSession } from "../hooks/use-office-host-session";

export function OfficeHostLobbyOverlay({
  session,
}: {
  session: OfficeHostSession;
}) {
  const playerAssignments = useSpaceStore((state) => state.playerAssignments);
  const {
    roomId,
    players,
    selectedCount,
    canStartMatch,
    joinControls,
    startMatch,
  } = session;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1f2937]/70 p-4">
      <div className="w-full max-w-2xl border border-[#fef3c7] bg-[#fef3c7] p-6 text-[#5c4a2e] shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
              Room
            </p>
            <p className="text-xl font-bold">{roomId ?? "----"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
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
              <span className="text-xs tracking-[0.2em] text-[#8b6914] uppercase">
                Controller link
              </span>
            }
            copied={joinControls.copied}
            onCopy={joinControls.handleCopy}
            onOpen={joinControls.handleOpen}
            qrVisible={joinControls.joinQrVisible}
            onToggleQr={joinControls.toggleJoinQr}
            inputClassName="border-[#e5d4ab] bg-[#fff6d8] text-[#5c4a2e] placeholder:text-[#8b6914]/70"
            buttonClassName="rounded-none border-[#8b6914]/25 bg-[#8b6914] text-[#fdf6e3] hover:bg-[#7a5b11]"
          />
        </div>

        <div className="mb-4 max-h-64 overflow-y-auto border border-[#e5d4ab] bg-[#fff6d8] p-3">
          {players.length === 0 ? (
            <p className="text-sm text-[#6b7280]">
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
                  ? getPlayerCapabilityHighlights(selectedCharacterId, 2)
                  : [];

                return (
                  <li
                    key={player.id}
                    className="border-b border-[#e5d4ab] pb-2 text-sm last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{player.label}</p>
                        <p className="text-xs text-[#8b6914]">
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
                        <div className="space-y-1 text-[11px] text-[#5c4a2e]">
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
          buttonClassName="rounded-none border-[#8b6914]/25 bg-[#8b6914] px-5 text-[#fdf6e3] hover:bg-[#7a5b11]"
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
