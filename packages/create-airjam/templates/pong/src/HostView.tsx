import { useAirJamHost, useGetInput } from "@air-jam/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { type GameInput, gameInputSchema } from "./types";

const PADDLE_HEIGHT = 100;
const PADDLE_WIDTH = 15;
const BALL_SIZE = 15;
const PADDLE_SPEED = 8;
const BALL_SPEED = 5;

export function HostView() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const getInput = useGetInput<typeof gameInputSchema>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scores, setScores] = useState({ player1: 0, player2: 0 });

  // Game state refs (to avoid re-renders in game loop)
  const gameState = useRef({
    paddle1Y: 250,
    paddle2Y: 250,
    ballX: 400,
    ballY: 300,
    ballVX: BALL_SPEED,
    ballVY: BALL_SPEED,
  });

  const resetBall = useCallback(() => {
    const state = gameState.current;
    state.ballX = 400;
    state.ballY = 300;
    state.ballVX = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
    state.ballVY = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const gameLoop = () => {
      const state = gameState.current;
      const controllers = host.controllers;

      // Get input from first two controllers
      const controllerIds = Object.keys(controllers);
      const player1Input = controllerIds[0] ? getInput(controllerIds[0]) : null;
      const player2Input = controllerIds[1] ? getInput(controllerIds[1]) : null;

      // Move paddles based on input
      if (player1Input) {
        state.paddle1Y += (player1Input as GameInput).direction * PADDLE_SPEED;
        state.paddle1Y = Math.max(0, Math.min(600 - PADDLE_HEIGHT, state.paddle1Y));
      }
      if (player2Input) {
        state.paddle2Y += (player2Input as GameInput).direction * PADDLE_SPEED;
        state.paddle2Y = Math.max(0, Math.min(600 - PADDLE_HEIGHT, state.paddle2Y));
      }

      // Move ball
      state.ballX += state.ballVX;
      state.ballY += state.ballVY;

      // Ball collision with top/bottom walls
      if (state.ballY <= 0 || state.ballY >= 600 - BALL_SIZE) {
        state.ballVY *= -1;
      }

      // Ball collision with paddles
      // Left paddle
      if (
        state.ballX <= 30 + PADDLE_WIDTH &&
        state.ballX >= 30 &&
        state.ballY + BALL_SIZE >= state.paddle1Y &&
        state.ballY <= state.paddle1Y + PADDLE_HEIGHT
      ) {
        state.ballVX = Math.abs(state.ballVX);
      }
      // Right paddle
      if (
        state.ballX >= 800 - 30 - PADDLE_WIDTH - BALL_SIZE &&
        state.ballX <= 800 - 30 &&
        state.ballY + BALL_SIZE >= state.paddle2Y &&
        state.ballY <= state.paddle2Y + PADDLE_HEIGHT
      ) {
        state.ballVX = -Math.abs(state.ballVX);
      }

      // Scoring
      if (state.ballX <= 0) {
        setScores((s) => ({ ...s, player2: s.player2 + 1 }));
        resetBall();
      }
      if (state.ballX >= 800 - BALL_SIZE) {
        setScores((s) => ({ ...s, player1: s.player1 + 1 }));
        resetBall();
      }

      // Draw
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 800, 600);

      ctx.fillStyle = "#fff";
      // Paddles
      ctx.fillRect(30, state.paddle1Y, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillRect(800 - 30 - PADDLE_WIDTH, state.paddle2Y, PADDLE_WIDTH, PADDLE_HEIGHT);
      // Ball
      ctx.fillRect(state.ballX, state.ballY, BALL_SIZE, BALL_SIZE);
      // Center line
      ctx.setLineDash([5, 15]);
      ctx.beginPath();
      ctx.moveTo(400, 0);
      ctx.lineTo(400, 600);
      ctx.strokeStyle = "#333";
      ctx.stroke();

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();
    return () => cancelAnimationFrame(animationId);
  }, [host.controllers, getInput, resetBall]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4">
      <h1 className="mb-4 text-3xl font-bold text-white">Pong</h1>
      <div className="mb-4 text-2xl text-white">
        {scores.player1} - {scores.player2}
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="rounded-lg border-2 border-white"
      />
      <div className="mt-4 text-gray-400">
        {Object.keys(host.controllers).length === 0 ? (
          <p>Waiting for players to connect... Scan the QR code!</p>
        ) : (
          <p>{Object.keys(host.controllers).length} player(s) connected</p>
        )}
      </div>
    </div>
  );
}
