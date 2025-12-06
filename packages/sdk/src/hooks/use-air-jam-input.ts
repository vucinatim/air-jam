import { useCallback, useEffect, useRef } from "react";
import type { z } from "zod";
import type { ControllerInputEvent } from "../protocol";
import { getSocketClient } from "../socket-client";

interface UseAirJamInputOptions<TInput = Record<string, unknown>> {
  /**
   * Optional: Only listen to inputs from this room.
   * If not provided, listens to all rooms (useful for testing).
   */
  roomId?: string;
  /**
   * Optional: Zod schema for input validation and type inference.
   * If provided, inputs will be validated and returned as the inferred type.
   * If not provided, inputs are returned as Record<string, unknown>.
   */
  schema?: z.ZodSchema<TInput>;
}

/**
 * Type-safe input buffer for high-frequency input processing in game loops.
 *
 * Key features:
 * - Zero React re-renders (uses refs only)
 * - Pop-based consumption model (read once per frame)
 * - Type-safe with Zod schema validation and inference
 * - Completely decoupled from UI/lobby logic
 *
 * For latching behavior (catching rapid taps), use `useAirJamInputLatch` utility hook.
 *
 * @example
 * ```tsx
 * // With Zod schema (recommended - type-safe + validated)
 * const inputSchema = z.object({
 *   vector: z.object({ x: z.number(), y: z.number() }),
 *   action: z.boolean(),
 *   ability: z.boolean(),
 * });
 * const { popInput } = useAirJamInput({ roomId: "ABCD", schema: inputSchema });
 *
 * useFrame(() => {
 *   const input = popInput(controllerId);
 *   if (input) {
 *     // input is fully typed! No manual type guards needed
 *     input.vector.x; // number
 *     input.action; // boolean
 *   }
 * });
 * ```
 */
export const useAirJamInput = <TInput = Record<string, unknown>>(
  options: UseAirJamInputOptions<TInput> = {},
): {
  /**
   * Reads the raw input for a specific controller.
   * Does NOT remove from buffer - input persists until new input arrives.
   * Returns validated and typed input if schema is provided, otherwise raw Record.
   */
  popInput: (
    controllerId: string,
  ) => TInput extends Record<string, unknown>
    ? TInput | undefined
    : Record<string, unknown> | undefined;
  /**
   * Clears input state for a controller (e.g., when player leaves).
   */
  clearInput: (controllerId: string) => void;
} => {
  const { schema } = options;
  // Use a Map to store raw input for all controllers
  // Refs ensure this never triggers a React re-render (CRITICAL for game loops)
  const inputBuffer = useRef<Map<string, Record<string, unknown>>>(new Map());

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

      // Store raw input as-is (arbitrary structure)
      inputBuffer.current.set(payload.controllerId, payload.input);
    };

    socket.on("server:input", handleInput);

    return () => {
      socket.off("server:input", handleInput);
    };
  }, [options.roomId]);

  /**
   * Reads the raw input for a specific controller.
   * Does NOT remove from buffer - input persists until new input arrives.
   * This allows latching utilities to maintain state between frames.
   * If schema is provided, validates and returns typed result.
   */
  const popInput = useCallback(
    (
      controllerId: string,
    ): TInput extends Record<string, unknown>
      ? TInput | undefined
      : Record<string, unknown> | undefined => {
      const buffer = inputBuffer.current;
      const rawInput = buffer.get(controllerId);

      if (!rawInput) {
        return undefined as TInput extends Record<string, unknown>
          ? TInput | undefined
          : Record<string, unknown> | undefined;
      }

      // If schema provided, validate and return typed result
      if (schema) {
        const result = schema.safeParse(rawInput);
        if (result.success) {
          return result.data as TInput extends Record<string, unknown>
            ? TInput | undefined
            : Record<string, unknown> | undefined;
        }
        // Validation failed - log error and return undefined
        console.warn(
          `[useAirJamInput] Invalid input for controller ${controllerId}:`,
          result.error.errors,
        );
        return undefined as TInput extends Record<string, unknown>
          ? TInput | undefined
          : Record<string, unknown> | undefined;
      }

      // No schema - return raw input
      return rawInput as TInput extends Record<string, unknown>
        ? TInput | undefined
        : Record<string, unknown> | undefined;
    },
    [schema],
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
