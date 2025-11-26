import { useCallback, useEffect, useRef } from "react";
import { getSocketClient } from "../socket-client";
import type { ControllerInputEvent } from "../protocol";

/**
 * The shape of the input the game loop will consume.
 * This is a clean, simple interface for game logic.
 */
export interface GameLoopInput {
  vector: { x: number; y: number };
  action: boolean;
  ability: boolean;
  timestamp: number;
}

/**
 * Internal state that tracks both latched (consumable) and raw (physical) input.
 * The latch ensures rapid taps are never missed.
 */
interface InternalInputState extends GameLoopInput {
  // We strictly track the physical truth separately from the game truth
  _rawVector: { x: number; y: number };
  _rawAction: boolean;
  _rawAbility: boolean;
}

interface UseAirJamInputOptions {
  /**
   * Optional: Only listen to inputs from this room.
   * If not provided, listens to all rooms (useful for testing).
   */
  roomId?: string;
}

/**
 * A specialized hook for high-frequency input processing in game loops.
 *
 * Key features:
 * - Zero React re-renders (uses refs only)
 * - Latch pattern ensures rapid taps are never missed
 * - Pop-based consumption model (read once per frame)
 * - Completely decoupled from UI/lobby logic
 *
 * @example
 * ```tsx
 * const { popInput, clearInput } = useAirJamInput({ roomId: "ABCD" });
 *
 * useFrame(() => {
 *   const input = popInput(controllerId);
 *   if (input?.ability) {
 *     // Fire ability - guaranteed to catch rapid taps
 *   }
 * });
 * ```
 */
export const useAirJamInput = (
  options: UseAirJamInputOptions = {}
): {
  /**
   * Reads and consumes the input for a specific controller.
   * Call this ONCE per frame per controller.
   * Returns undefined if no input exists for that controller.
   */
  popInput: (controllerId: string) => GameLoopInput | undefined;
  /**
   * Clears input state for a controller (e.g., when player leaves).
   */
  clearInput: (controllerId: string) => void;
} => {
  // Use a Map to store input state for all controllers
  // Refs ensure this never triggers a React re-render (CRITICAL for game loops)
  const inputBuffer = useRef<Map<string, InternalInputState>>(new Map());

  useEffect(() => {
    // 1. Get the SAME socket instance used by useAirJamHost
    // Since getSocketClient follows singleton pattern for the same role/url,
    // this hook piggybacks on the existing connection.
    const socket = getSocketClient("host");

    const handleInput = (payload: ControllerInputEvent): void => {
      // Security/Sanity check: Only process inputs from our room
      if (options.roomId && payload.roomId !== options.roomId) {
        return;
      }

      const buffer = inputBuffer.current;
      const prev = buffer.get(payload.controllerId);

      // 1. Get Physical Truth (Raw)
      const rawAction = payload.input.action;
      const rawAbility = payload.input.ability ?? false;
      const rawVector = payload.input.vector;

      // 2. Calculate Latched Truth (Game)
      // Rule: If it's physically true NOW, or was true since last frame, it's true.
      const latchedAction = rawAction || (prev?.action ?? false);
      const latchedAbility = rawAbility || (prev?.ability ?? false);

      // Vector Latch Rule:
      // If we are moving NOW, use current vector.
      // If we stopped moving (raw=0) but moved since last frame (prev=nonzero), keep the prev vector.
      const isRawVectorActive = rawVector.x !== 0 || rawVector.y !== 0;

      let latchedVector = rawVector;

      if (!isRawVectorActive && prev) {
        // User released stick. Did they have a latched value waiting?
        const isPrevVectorActive = prev.vector.x !== 0 || prev.vector.y !== 0;
        if (isPrevVectorActive) {
          latchedVector = prev.vector; // Keep the flick alive
        }
      }

      buffer.set(payload.controllerId, {
        // Public Game State
        vector: latchedVector,
        action: latchedAction,
        ability: latchedAbility,
        timestamp: payload.input.timestamp ?? Date.now(),

        // Private Physical State (Stored for the reset phase)
        _rawVector: rawVector,
        _rawAction: rawAction,
        _rawAbility: rawAbility,
      });
    };

    socket.on("server:input", handleInput);

    return () => {
      socket.off("server:input", handleInput);
    };
  }, [options.roomId]);

  /**
   * Reads and Consumes the input for a specific controller.
   * Call this ONCE per frame per controller.
   *
   * The latch is consumed by resetting the public state to match
   * the raw physical state. This ensures:
   * - A tap (true -> false) triggers exactly once when consumed
   * - Holding the button keeps it true every frame until released
   */
  const popInput = useCallback(
    (controllerId: string): GameLoopInput | undefined => {
      const buffer = inputBuffer.current;
      const state = buffer.get(controllerId);

      if (!state) {
        return undefined;
      }

      // 1. Return the public "Latched" state
      const result: GameLoopInput = {
        vector: state.vector,
        action: state.action,
        ability: state.ability,
        timestamp: state.timestamp,
      };

      // 2. RESET PHASE
      // We do NOT reset to false/zero. We reset to the RAW physical state.
      // - If user held button: Latched was TRUE. Raw is TRUE. Reset to TRUE. (Hold works)
      // - If user tapped button: Latched was TRUE. Raw is FALSE. Reset to FALSE. (Tap works)
      // - If user held stick: Latched was non-zero. Raw is non-zero. Reset to non-zero. (Hold works)
      // - If user flicked stick: Latched was non-zero. Raw is zero. Reset to zero. (Flick consumed)
      buffer.set(controllerId, {
        ...state,
        vector: state._rawVector, // Reset to physical stick position
        action: state._rawAction, // Reset to physical button state
        ability: state._rawAbility, // Reset to physical button state
      });

      return result;
    },
    []
  );

  /**
   * Helper to clean up data when a player leaves.
   * Prevents memory leaks and stale input states.
   */
  const clearInput = useCallback((controllerId: string): void => {
    inputBuffer.current.delete(controllerId);
  }, []);

  return {
    popInput,
    clearInput,
  };
};
