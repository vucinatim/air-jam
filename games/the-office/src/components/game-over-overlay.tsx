/**
 * Game over overlay component displayed when all players have died.
 */

interface GameOverOverlayProps {
  totalMoney: number;
  onRestart: () => void;
}

/**
 * Overlay component shown when the game ends.
 */
export function GameOverOverlay({
  totalMoney,
  onRestart,
}: GameOverOverlayProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="relative">
        {/* Shadow note behind */}
        <div
          className="absolute inset-0 bg-amber-200"
          style={{
            transform: "rotate(-2deg) translateY(6px)",
            boxShadow: "2px 3px 8px rgba(0, 0, 0, 0.15)",
          }}
        />
        {/* Main post-it note */}
        <div
          className="relative flex min-w-[320px] flex-col items-center justify-center bg-amber-100 p-10"
          style={{
            transform: "rotate(1deg)",
            boxShadow: "3px 4px 12px rgba(0, 0, 0, 0.2)",
          }}
        >
          <h2 className="mb-3 text-4xl font-bold tracking-tight text-slate-800">
            KONEC IGRE
          </h2>
          <p className="mb-4 text-lg text-slate-600">Vsi igralci so umrli</p>
          <div className="mb-8 text-xl font-semibold text-slate-800">
            Končni rezultat: {totalMoney}€
          </div>
          <button
            onClick={onRestart}
            className="bg-slate-800 px-8 py-3 text-lg font-semibold text-amber-100 transition-colors hover:bg-slate-700"
            style={{
              boxShadow: "2px 3px 6px rgba(0, 0, 0, 0.15)",
            }}
          >
            Igraj ponovno
          </button>
        </div>
      </div>
    </div>
  );
}
