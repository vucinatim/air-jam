import { HostShell, PlayerAvatar, useAirJamHost } from "@air-jam/sdk";
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
  const scores = usePongStore((state) => state.scores);
  const teamAssignments = usePongStore((state) => state.teamAssignments);
  const actions = usePongStore((state) => state.actions);

  // Game state refs (to avoid re-renders in game loop)
  const gameState = useRef({
    paddle1FrontY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    paddle1BackY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    paddle2FrontY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    paddle2BackY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
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
      if (isPlaying) {
        // Loop through players and apply input based on team and position
        players.forEach((p) => {
          // Get Raw Input (High Frequency)
          const input = host.getInput(p.id);

          // Get Logic State (Low Frequency)
          const assignment = teamAssignments[p.id];

          if (input && assignment) {
            const { team, position } = assignment;
            // Apply physics based on team and position!
            if (team === "team1") {
              if (position === "front") {
                state.paddle1FrontY += input.direction * PADDLE_SPEED;
                state.paddle1FrontY = Math.max(
                  0,
                  Math.min(FIELD_HEIGHT - PADDLE_HEIGHT, state.paddle1FrontY),
                );
              } else {
                state.paddle1BackY += input.direction * PADDLE_SPEED;
                state.paddle1BackY = Math.max(
                  0,
                  Math.min(FIELD_HEIGHT - PADDLE_HEIGHT, state.paddle1BackY),
                );
              }
            }
            if (team === "team2") {
              if (position === "front") {
                state.paddle2FrontY += input.direction * PADDLE_SPEED;
                state.paddle2FrontY = Math.max(
                  0,
                  Math.min(FIELD_HEIGHT - PADDLE_HEIGHT, state.paddle2FrontY),
                );
              } else {
                state.paddle2BackY += input.direction * PADDLE_SPEED;
                state.paddle2BackY = Math.max(
                  0,
                  Math.min(FIELD_HEIGHT - PADDLE_HEIGHT, state.paddle2BackY),
                );
              }
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
        // Team 1 - Left side (Orange)
        const team1Players = players.filter(
          (p) => teamAssignments[p.id]?.team === "team1",
        );
        // Front paddle collision (only if front player exists)
        const team1FrontPlayer = team1Players.find(
          (p) => teamAssignments[p.id]?.position === "front",
        );
        if (team1FrontPlayer) {
          if (
            state.ballX <= PADDLE_OFFSET + PADDLE_WIDTH &&
            state.ballX >= PADDLE_OFFSET &&
            state.ballY + BALL_SIZE >= state.paddle1FrontY &&
            state.ballY <= state.paddle1FrontY + PADDLE_HEIGHT
          ) {
            state.ballVX = Math.abs(state.ballVX);
            state.lastTouchedTeam = "team1";
          }
        }
        // Back paddle collision (only if back player exists)
        const team1BackPlayer = team1Players.find(
          (p) => teamAssignments[p.id]?.position === "back",
        );
        if (team1BackPlayer) {
          const backPaddle1X = PADDLE_OFFSET / 2;
          if (
            state.ballX <= backPaddle1X + PADDLE_WIDTH &&
            state.ballX >= backPaddle1X &&
            state.ballY + BALL_SIZE >= state.paddle1BackY &&
            state.ballY <= state.paddle1BackY + PADDLE_HEIGHT
          ) {
            state.ballVX = Math.abs(state.ballVX);
            state.lastTouchedTeam = "team1";
          }
        }
        // Team 2 - Right side (Blue)
        const team2Players = players.filter(
          (p) => teamAssignments[p.id]?.team === "team2",
        );
        // Front paddle collision (only if front player exists)
        const team2FrontPlayer = team2Players.find(
          (p) => teamAssignments[p.id]?.position === "front",
        );
        if (team2FrontPlayer) {
          if (
            state.ballX >=
              FIELD_WIDTH - PADDLE_OFFSET - PADDLE_WIDTH - BALL_SIZE &&
            state.ballX <= FIELD_WIDTH - PADDLE_OFFSET &&
            state.ballY + BALL_SIZE >= state.paddle2FrontY &&
            state.ballY <= state.paddle2FrontY + PADDLE_HEIGHT
          ) {
            state.ballVX = -Math.abs(state.ballVX);
            state.lastTouchedTeam = "team2";
          }
        }
        // Back paddle collision (only if back player exists)
        const team2BackPlayer = team2Players.find(
          (p) => teamAssignments[p.id]?.position === "back",
        );
        if (team2BackPlayer) {
          const backPaddle2X = FIELD_WIDTH - PADDLE_OFFSET / 2 - PADDLE_WIDTH;
          if (
            state.ballX >= backPaddle2X - BALL_SIZE &&
            state.ballX <= backPaddle2X + PADDLE_WIDTH &&
            state.ballY + BALL_SIZE >= state.paddle2BackY &&
            state.ballY <= state.paddle2BackY + PADDLE_HEIGHT
          ) {
            state.ballVX = -Math.abs(state.ballVX);
            state.lastTouchedTeam = "team2";
          }
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

      // Paddles - Team 1 (Left side - Orange)
      // Only draw paddles for players that are actually assigned
      const team1Players = players.filter(
        (p) => teamAssignments[p.id]?.team === "team1",
      );
      if (team1Players.length > 0) {
        ctx.fillStyle = TEAM1_COLOR;
        // Check if front position is assigned
        const frontPlayer = team1Players.find(
          (p) => teamAssignments[p.id]?.position === "front",
        );
        if (frontPlayer) {
          ctx.fillRect(
            PADDLE_OFFSET,
            state.paddle1FrontY,
            PADDLE_WIDTH,
            PADDLE_HEIGHT,
          );
        }
        // Check if back position is assigned
        const backPlayer = team1Players.find(
          (p) => teamAssignments[p.id]?.position === "back",
        );
        if (backPlayer) {
          ctx.fillRect(
            PADDLE_OFFSET / 2,
            state.paddle1BackY,
            PADDLE_WIDTH,
            PADDLE_HEIGHT,
          );
        }
      }

      // Paddles - Team 2 (Right side - Blue)
      // Only draw paddles for players that are actually assigned
      const team2Players = players.filter(
        (p) => teamAssignments[p.id]?.team === "team2",
      );
      if (team2Players.length > 0) {
        ctx.fillStyle = TEAM2_COLOR;
        // Check if front position is assigned
        const frontPlayer = team2Players.find(
          (p) => teamAssignments[p.id]?.position === "front",
        );
        if (frontPlayer) {
          ctx.fillRect(
            FIELD_WIDTH - PADDLE_OFFSET - PADDLE_WIDTH,
            state.paddle2FrontY,
            PADDLE_WIDTH,
            PADDLE_HEIGHT,
          );
        }
        // Check if back position is assigned
        const backPlayer = team2Players.find(
          (p) => teamAssignments[p.id]?.position === "back",
        );
        if (backPlayer) {
          ctx.fillRect(
            FIELD_WIDTH - PADDLE_OFFSET / 2 - PADDLE_WIDTH,
            state.paddle2BackY,
            PADDLE_WIDTH,
            PADDLE_HEIGHT,
          );
        }
      }
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
  }, [host, resetBall, countdown, teamAssignments, actions]);

  return (
    <HostShell>
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-900 p-4">
        {/* UI Layer using Store Data */}
        <div className="mb-4 flex w-full max-w-4xl items-center gap-4">
          {/* Left flex spacer */}
          <div className="flex-1" />

          {/* Team 1 Avatars */}
          <div className="flex w-20 items-center justify-end gap-2">
            {host.players
              .filter((p) => teamAssignments[p.id]?.team === "team1")
              .map((player) => (
                <PlayerAvatar key={player.id} player={player} size="sm" />
              ))}
          </div>

          {/* Score */}
          <div className="flex items-center gap-2 text-2xl font-bold">
            <span style={{ color: TEAM1_COLOR }}>{scores.team1}</span>
            <span className="text-white">-</span>
            <span style={{ color: TEAM2_COLOR }}>{scores.team2}</span>
          </div>

          {/* Team 2 Avatars */}
          <div className="flex w-20 items-center gap-2">
            {host.players
              .filter((p) => teamAssignments[p.id]?.team === "team2")
              .map((player) => (
                <PlayerAvatar key={player.id} player={player} size="sm" />
              ))}
          </div>

          {/* Right flex spacer */}
          <div className="flex-1" />
        </div>

        <canvas ref={canvasRef} className="rounded-lg border-2 border-white" />
      </div>
    </HostShell>
  );
}
