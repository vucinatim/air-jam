import { useGameStore } from "../../game/stores";

export const EndedScreen = () => {
  const matchSummary = useGameStore((state) => state.matchSummary);
  const scores = useGameStore((state) => state.scores);
  const actions = useGameStore.useActions();

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-black/65 p-3 sm:p-4">
      <div className="flex min-h-full w-full items-center justify-center">
        <div className="pixel-font w-full max-w-2xl rounded-none border-4 border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-[6px_6px_0_rgba(0,0,0,0.8)]">
          <p className="text-xs tracking-[0.2em] text-zinc-400 uppercase">
            Match Ended
          </p>
          <p className="mt-2 text-3xl text-white">
            {matchSummary?.winner === "draw"
              ? "Draw"
              : matchSummary?.winner === "team1"
                ? "Coder Team Wins"
                : "Reviewer Team Wins"}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 text-center">
            <div className="rounded-none border-2 border-zinc-700 bg-zinc-800/70 p-4">
              <p className="text-xs tracking-[0.16em] text-zinc-400 uppercase">
                Coder
              </p>
              <p className="mt-2 text-5xl text-red-500">
                {matchSummary?.scores.team1 ?? scores.team1}
              </p>
            </div>
            <div className="rounded-none border-2 border-zinc-700 bg-zinc-800/70 p-4">
              <p className="text-xs tracking-[0.16em] text-zinc-400 uppercase">
                Reviewer
              </p>
              <p className="mt-2 text-5xl text-blue-500">
                {matchSummary?.scores.team2 ?? scores.team2}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => actions.resetToLobby()}
              className="rounded-none border-4 border-zinc-300 bg-zinc-800 px-6 py-3 text-sm uppercase transition hover:bg-zinc-700"
            >
              Back To Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
