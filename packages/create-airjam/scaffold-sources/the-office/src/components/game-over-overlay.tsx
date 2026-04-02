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
          className="relative flex flex-col items-center justify-center p-10 min-w-[320px] bg-amber-100"
          style={{
            transform: "rotate(1deg)",
            boxShadow: "3px 4px 12px rgba(0, 0, 0, 0.2)",
          }}
        >
          <h2 className="text-4xl font-bold text-slate-800 mb-3 tracking-tight">
            KONEC IGRE
          </h2>
          <p className="text-lg text-slate-600 mb-4">
            Vsi igralci so umrli
          </p>
          <div className="text-xl text-slate-800 font-semibold mb-8">
            Končni rezultat: {totalMoney}€
          </div>
          <button
            onClick={onRestart}
            className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-amber-100 font-semibold text-lg transition-colors"
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
