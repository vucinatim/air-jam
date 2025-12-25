import { AirJamDebug, AirJamOverlay, useAirJamHost } from "@air-jam/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePongStore } from "./store";
import { gameInputSchema } from "./types";

const FIELD_WIDTH = 1000;
const FIELD_HEIGHT = 600;
const PADDLE_HEIGHT = 100;
const PADDLE_WIDTH = 15;
const PADDLE_OFFSET = 30;
const BALL_SIZE = 15;
const PADDLE_SPEED = 6;
const BALL_SPEED = 3;
const TEAM1_COLOR = "#f97316"; // (Solaris)
const TEAM2_COLOR = "#38bdf8"; // (Nebulon)

export function HostView() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // 1. Read Game Logic State (UI & Rules)
  // Shared networked state with zustand reducers to minimize re-renders
  const phase = usePongStore((state) => state.phase);
  const scores = usePongStore((state) => state.scores);
  const teamAssignments = usePongStore((state) => state.teamAssignments);
  const actions = usePongStore((state) => state.actions);

  // Game state refs (to avoid re-renders in game loop)
  const gameState = useRef({
    paddle1Y: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    paddle2Y: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    ballX: FIELD_WIDTH / 2,
    ballY: FIELD_HEIGHT / 2,
    ballVX: BALL_SPEED,
    ballVY: BALL_SPEED,
    lastTouchedTeam: null as "team1" | "team2" | null, // Track which team last touched the ball
  });

  const resetBall = useCallback(() => {
    const state = gameState.current;
    state.ballX = FIELD_WIDTH / 2;
    state.ballY = FIELD_HEIGHT / 2;
    state.ballVX = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
    state.ballVY = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
    state.lastTouchedTeam = null; // Reset ball color to neutral
  }, []);

  // Handle countdown timer (only when playing)
  useEffect(() => {
    if (countdown === null) return;
    if (host.gameState !== "playing") return; // Don't progress countdown when paused

    if (countdown === 0) {
      resetBall();
      // Defer state update to avoid cascading renders
      setTimeout(() => {
        setCountdown(null);
      }, 0);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, host.gameState, resetBall]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = FIELD_WIDTH * dpr;
    canvas.height = FIELD_HEIGHT * dpr;
    canvas.style.width = `${FIELD_WIDTH}px`;
    canvas.style.height = `${FIELD_HEIGHT}px`;
    ctx.scale(dpr, dpr);

    let animationId: number;

    const gameLoop = () => {
      const state = gameState.current;
      const players = host.players;
      const isPlaying = host.gameState === "playing";

      // Only process game logic when playing (not paused)
      if (isPlaying && phase === "playing") {
        // Loop through players and apply input based on team
        players.forEach((p) => {
          // Get Raw Input (High Frequency)
          const input = host.getInput(p.id);

          // Get Logic State (Low Frequency)
          const team = teamAssignments[p.id];

          if (input && team) {
            // Apply physics based on team!
            if (team === "team1") {
              state.paddle1Y += input.direction * PADDLE_SPEED;
              state.paddle1Y = Math.max(
                0,
                Math.min(FIELD_HEIGHT - PADDLE_HEIGHT, state.paddle1Y),
              );
            }
            if (team === "team2") {
              state.paddle2Y += input.direction * PADDLE_SPEED;
              state.paddle2Y = Math.max(
                0,
                Math.min(FIELD_HEIGHT - PADDLE_HEIGHT, state.paddle2Y),
              );
            }
          }
        });

        // Move ball (only if not in countdown)
        if (countdown === null) {
          state.ballX += state.ballVX;
          state.ballY += state.ballVY;
        }

        // Ball collision with top/bottom walls
        if (state.ballY <= 0 || state.ballY >= FIELD_HEIGHT - BALL_SIZE) {
          state.ballVY *= -1;
        }

        // Ball collision with paddles
        // Left paddle (Team 1 - Orange)
        if (
          state.ballX <= PADDLE_OFFSET + PADDLE_WIDTH &&
          state.ballX >= PADDLE_OFFSET &&
          state.ballY + BALL_SIZE >= state.paddle1Y &&
          state.ballY <= state.paddle1Y + PADDLE_HEIGHT
        ) {
          state.ballVX = Math.abs(state.ballVX);
          state.lastTouchedTeam = "team1";
        }
        // Right paddle (Team 2 - Blue)
        if (
          state.ballX >=
            FIELD_WIDTH - PADDLE_OFFSET - PADDLE_WIDTH - BALL_SIZE &&
          state.ballX <= FIELD_WIDTH - PADDLE_OFFSET &&
          state.ballY + BALL_SIZE >= state.paddle2Y &&
          state.ballY <= state.paddle2Y + PADDLE_HEIGHT
        ) {
          state.ballVX = -Math.abs(state.ballVX);
          state.lastTouchedTeam = "team2";
        }

        // Scoring
        if (countdown === null) {
          if (state.ballX <= 0) {
            actions.scorePoint("team2");
            setCountdown(3);
          }
          if (state.ballX >= FIELD_WIDTH - BALL_SIZE) {
            actions.scorePoint("team1");
            setCountdown(3);
          }
        }
      }

      // Draw
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

      // Paddles
      ctx.fillStyle = TEAM1_COLOR;
      ctx.fillRect(PADDLE_OFFSET, state.paddle1Y, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillStyle = TEAM2_COLOR;
      ctx.fillRect(
        FIELD_WIDTH - PADDLE_OFFSET - PADDLE_WIDTH,
        state.paddle2Y,
        PADDLE_WIDTH,
        PADDLE_HEIGHT,
      );
      // Ball (color based on last team that touched it)
      ctx.fillStyle =
        state.lastTouchedTeam === "team1"
          ? TEAM1_COLOR
          : state.lastTouchedTeam === "team2"
            ? TEAM2_COLOR
            : "#fff"; // Neutral white if no team has touched it
      ctx.beginPath();
      ctx.arc(
        state.ballX + BALL_SIZE / 2,
        state.ballY + BALL_SIZE / 2,
        BALL_SIZE / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      // Center line
      ctx.setLineDash([5, 15]);
      ctx.beginPath();
      ctx.moveTo(FIELD_WIDTH / 2, 0);
      ctx.lineTo(FIELD_WIDTH / 2, FIELD_HEIGHT);
      ctx.strokeStyle = "#333";
      ctx.stroke();

      // Draw countdown
      if (countdown !== null) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 120px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(countdown.toString(), FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();
    return () => cancelAnimationFrame(animationId);
  }, [host, resetBall, countdown, phase, teamAssignments, actions]);

  return (
    <>
      <AirJamOverlay
        roomId={host.roomId}
        joinUrl={host.joinUrl}
        connectionStatus={host.connectionStatus}
        players={host.players}
        lastError={host.lastError}
        gameState={host.gameState}
        onTogglePlayPause={host.toggleGameState}
        isChildMode={host.isChildMode}
      />

      {/* Debug State Component */}
      <div className="fixed top-20 right-4 z-50">
        <AirJamDebug
          state={usePongStore((state) => state)}
          title="Pong Game State"
        />
      </div>

      <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-900 p-4">
        {/* UI Layer using Store Data */}
        <div className="mb-4 flex items-center gap-2 text-2xl font-bold">
          <span style={{ color: TEAM1_COLOR }}>{scores.team1}</span>
          <span className="text-white">-</span>
          <span style={{ color: TEAM2_COLOR }}>{scores.team2}</span>
        </div>

        {phase === "lobby" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
            <h2 className="mb-4 text-4xl font-bold text-white">
              Waiting for players...
            </h2>
            {/* Start button dispatches to store */}
            <button
              onClick={() => actions.setPhase("playing")}
              className="rounded-lg bg-blue-500 px-8 py-4 text-2xl font-bold text-white hover:bg-blue-600"
            >
              START GAME
            </button>
          </div>
        )}

        <canvas ref={canvasRef} className="rounded-lg border-2 border-white" />
      </div>
    </>
  );
}
