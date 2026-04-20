import type { PlayerProfile } from "@air-jam/sdk";
import {
  JoinQrOverlay,
  JoinUrlControls,
  LifecycleActionGroup,
  useHostJoinControls,
} from "@air-jam/sdk/ui";
import { HOST_STATUS_COPY } from "../../game/engine/constants";
import { useClipboardCopy } from "../hooks/use-clipboard-copy";
import type { CodeReviewHostTeams } from "../hooks/use-code-review-host-teams";

interface LobbyScreenProps {
  joinUrl: string;
  roomId: string | null;
  connectionStatus: string;
  players: PlayerProfile[];
  teams: CodeReviewHostTeams;
  onStartMatch: () => void;
}

export const LobbyScreen = ({
  joinUrl,
  roomId,
  connectionStatus,
  players,
  teams,
  onStartMatch,
}: LobbyScreenProps) => {
  const clipboard = useClipboardCopy();
  const hostJoinControls = useHostJoinControls({
    joinUrl,
    canStartMatch: teams.canStartMatch,
  });
  const hostStatusText = HOST_STATUS_COPY[connectionStatus] ?? connectionStatus;

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-black/65 p-2 sm:p-3 md:p-4">
      <div className="mx-auto flex min-h-full w-full max-w-4/5 items-center justify-center">
        <div
          className="pixel-font relative flex w-full flex-col overflow-hidden rounded-none border-4 border-zinc-700 bg-zinc-900 text-zinc-100 shadow-[6px_6px_0_rgba(0,0,0,0.8)] xl:max-w-[1780px] 2xl:max-w-[1920px]"
          style={{
            height: "auto",
            maxHeight: "none",
          }}
        >
          <div className="min-h-0 flex-1 p-3 sm:p-4 md:p-5">
            <div className="grid h-full min-h-0 gap-3 md:gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.7fr)]">
              <div className="order-1 flex h-44 items-center justify-center rounded-none border-4 border-zinc-700 bg-black p-1 sm:h-52 md:h-60 xl:h-auto xl:min-h-0">
                <img
                  src="/sprites/cover.png"
                  alt="Game cover"
                  className="h-full w-full object-cover object-center"
                />
              </div>

              <div className="order-2 flex min-h-0 flex-col xl:order-2">
                <div className="space-y-2 md:space-y-3">
                  <div>
                    <p className="text-[10px] tracking-[0.22em] text-zinc-400 uppercase">
                      Room
                    </p>
                    <p className="text-lg text-white">{roomId}</p>
                  </div>

                  <div className="inline-flex text-xs tracking-[0.22em] uppercase">
                    <span className="rounded-none border-2 border-zinc-600 px-2 py-1">
                      {hostStatusText}
                    </span>
                  </div>

                  <JoinUrlControls
                    value={hostJoinControls.joinUrlValue}
                    label="Join URL"
                    copied={hostJoinControls.copied}
                    onCopy={hostJoinControls.handleCopy}
                    onOpen={hostJoinControls.handleOpen}
                    qrVisible={hostJoinControls.joinQrVisible}
                    onToggleQr={hostJoinControls.toggleJoinQr}
                    className="pt-1"
                    inputClassName="pixel-font border-2 border-zinc-600 bg-black/80 text-xs text-zinc-100"
                    buttonClassName="border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                  />
                </div>

                <div className="mt-2 min-h-72 flex-1 rounded-none border-4 border-zinc-700 bg-zinc-900/45 p-3 md:mt-3">
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] tracking-[0.22em] text-zinc-400 uppercase">
                        Connected Players ({players.length})
                      </p>
                      <span className="text-[10px] tracking-[0.18em] text-zinc-400 uppercase">
                        Humans {teams.assignedHumanPlayers.length}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                      Auto Bots {teams.botCount} (Coder {teams.team1BotCount},
                      Reviewer {teams.team2BotCount})
                    </p>

                    <ul className="mt-2 space-y-1 pr-1">
                      {teams.slotParticipants.map((participant) => (
                        <li
                          key={participant.slotKey}
                          className="flex items-center justify-between border-b border-zinc-700 pb-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="block wrap-break-word text-zinc-100">
                              {participant.label}
                            </span>
                            <span className="block text-[10px] tracking-[0.15em] text-zinc-400 uppercase">
                              {participant.team === "team1"
                                ? "Coder"
                                : "Reviewer"}{" "}
                              •{" "}
                              {participant.position === "front"
                                ? "Front"
                                : "Back"}{" "}
                              • {participant.isBot ? "Bot" : "Human"}
                            </span>
                          </div>
                          {participant.isBot ? (
                            <span className="text-[10px] tracking-[0.15em] text-zinc-500 uppercase">
                              Auto
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="text-left text-[10px] text-zinc-300 underline-offset-2 hover:underline"
                              onClick={() => {
                                void clipboard.copyValue(participant.id);
                              }}
                              title="Copy player ID"
                            >
                              {clipboard.copiedValue === participant.id
                                ? "Copied!"
                                : participant.id.slice(0, 8)}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <LifecycleActionGroup
                    phase="lobby"
                    canInteract={teams.canStartMatch}
                    onStart={() => {
                      if (!teams.canStartMatch) return;
                      onStartMatch();
                    }}
                    startLabel="Play"
                    buttonClassName="rounded-none border-4 border-zinc-300 bg-zinc-800 text-white enabled:hover:bg-zinc-700"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <JoinQrOverlay
          open={hostJoinControls.joinQrVisible}
          value={hostJoinControls.joinUrlValue}
          roomId={roomId}
          onClose={hostJoinControls.hideJoinQr}
          description="Scan with your phone to join this Code Review room as a controller."
          panelClassName="rounded-none border-4 border-zinc-300 bg-zinc-950"
        />
      </div>
    </div>
  );
};
