import type { z } from "zod";
import type { ControllerInputEvent } from "../protocol";

/**
 * Configuration for input handling with optional validation and latching.
 */
export interface InputConfig<TSchema extends z.ZodSchema = z.ZodSchema> {
  /**
   * Optional Zod schema for input validation and type inference.
   * If provided, inputs will be validated and returned as the inferred type.
   */
  schema?: TSchema;
  /**
   * Optional latching configuration to ensure rapid taps/actions are never missed.
   */
  latch?: {
    /**
     * Field names that should be latched as booleans.
     * Latching ensures rapid taps are never missed.
     * Example: ['action', 'ability', 'jump']
     */
    booleanFields?: string[];
    /**
     * Field names that should be latched as vectors (with zero detection).
     * Vector latching keeps flicks alive for one frame after release.
     * Example: ['vector', 'direction', 'movement']
     */
    vectorFields?: string[];
  };
}

interface LatchState<TInput = Record<string, unknown>> {
  raw: TInput;
  latched: TInput;
  lastRawHash?: string; // Track if raw input changed
}

/**
 * Internal class that manages input buffering, validation, and latching.
 * Used internally by useAirJamHost to provide unified input handling.
 */
export class InputManager<TSchema extends z.ZodSchema = z.ZodSchema> {
  private inputBuffer = new Map<string, Record<string, unknown>>();
  private latchState = new Map<string, LatchState>();
  private config: InputConfig<TSchema>;
  private roomId?: string;

  constructor(config: InputConfig<TSchema> = {}, roomId?: string) {
    this.config = config;
    this.roomId = roomId;
  }

  /**
   * Handles incoming input events from the socket.
   * Should be called when 'server:input' event is received.
   */
  handleInput(payload: ControllerInputEvent): void {
    // Security/Sanity check: Only process inputs from our room
    if (this.roomId && payload.roomId !== this.roomId) {
      return;
    }

    // Store raw input as-is (arbitrary structure)
    this.inputBuffer.set(payload.controllerId, payload.input);
  }

  /**
   * Gets input for a specific controller.
   * Returns validated and typed input if schema is provided, otherwise raw Record.
   * If latching is configured, applies latching logic.
   */
  getInput(controllerId: string): z.infer<TSchema> | undefined {
    const rawInput = this.inputBuffer.get(controllerId);

    if (!rawInput) {
      return undefined;
    }

    // Validate with schema if provided
    let validatedInput: Record<string, unknown> = rawInput;
    if (this.config.schema) {
      const result = this.config.schema.safeParse(rawInput);
      if (!result.success) {
        // Validation failed - log error and return undefined
        console.warn(
          `[InputManager] Invalid input for controller ${controllerId}:`,
          result.error.errors,
        );
        return undefined;
      }
      validatedInput = result.data as Record<string, unknown>;
    }

    // Apply latching if configured
    if (this.config.latch) {
      return this.getLatched(controllerId, validatedInput as z.infer<TSchema>);
    }

    return validatedInput as z.infer<TSchema>;
  }

  /**
   * Clears input state for a controller (e.g., when player leaves).
   */
  clearInput(controllerId: string): void {
    this.inputBuffer.delete(controllerId);
    this.latchState.delete(controllerId);
  }

  /**
   * Updates the room ID filter.
   */
  setRoomId(roomId: string | undefined): void {
    this.roomId = roomId;
  }

  /**
   * Internal method to apply latching logic.
   */
  private getLatched<TInput extends Record<string, unknown>>(
    controllerId: string,
    rawInput: TInput,
  ): TInput | undefined {
    const { booleanFields = [], vectorFields = [] } = this.config.latch!;
    const state = this.latchState.get(controllerId);

    // Simple hash to detect if raw input changed
    const rawHash = JSON.stringify(rawInput);
    const rawChanged = rawHash !== state?.lastRawHash;

    // If raw hasn't changed and we have previous state, we already consumed
    // Return raw (reset behavior - like old popInput did)
    if (!rawChanged && state) {
      // Reset latched to raw for next frame (consume behavior)
      const resetLatched = { ...rawInput } as TInput;
      const resetLatchedRecord = resetLatched as Record<string, unknown>;
      const actualRawRecord = rawInput as Record<string, unknown>;

      // Reset boolean fields to raw
      for (const field of booleanFields) {
        const rawValue = actualRawRecord[field];
        resetLatchedRecord[field] = rawValue ?? false;
      }

      // Reset vector fields to raw
      for (const field of vectorFields) {
        const rawValue = actualRawRecord[field];
        if (
          rawValue &&
          typeof rawValue === "object" &&
          !Array.isArray(rawValue)
        ) {
          const rawVec = rawValue as { x?: unknown; y?: unknown };
          if (typeof rawVec.x === "number" && typeof rawVec.y === "number") {
            resetLatchedRecord[field] = rawVec;
          } else {
            resetLatchedRecord[field] = { x: 0, y: 0 };
          }
        } else {
          resetLatchedRecord[field] = { x: 0, y: 0 };
        }
      }

      // Update state with reset values
      this.latchState.set(controllerId, {
        raw: rawInput,
        latched: resetLatched,
        lastRawHash: rawHash,
      });

      return resetLatched; // Return raw (consumed)
    }

    // New input or first call - calculate latched
    const prevLatched = state?.latched ?? ({} as TInput);

    const latched = { ...rawInput } as TInput;
    const latchedRecord = latched as Record<string, unknown>;
    const actualRawRecord = rawInput as Record<string, unknown>;
    const prevLatchedRecord = prevLatched as Record<string, unknown>;

    // Latch boolean fields
    for (const field of booleanFields) {
      const rawValue = actualRawRecord[field];
      const prevValue = prevLatchedRecord[field];

      if (typeof rawValue === "boolean") {
        // Latch: true if currently true OR was true last frame
        latchedRecord[field] = rawValue || prevValue === true;
      }
    }

    // Latch vector fields (with zero detection)
    for (const field of vectorFields) {
      const rawValue = actualRawRecord[field];
      const prevValue = prevLatchedRecord[field];

      if (
        rawValue &&
        typeof rawValue === "object" &&
        !Array.isArray(rawValue)
      ) {
        const rawVec = rawValue as { x?: unknown; y?: unknown };
        const prevVec = prevValue as { x?: unknown; y?: unknown } | undefined;

        if (typeof rawVec.x === "number" && typeof rawVec.y === "number") {
          const isRawActive = rawVec.x !== 0 || rawVec.y !== 0;
          const isPrevActive =
            prevVec &&
            typeof prevVec.x === "number" &&
            typeof prevVec.y === "number" &&
            (prevVec.x !== 0 || prevVec.y !== 0);

          if (isRawActive) {
            // Currently active - use current value
            latchedRecord[field] = rawVec;
          } else if (isPrevActive) {
            // Just released but was active - keep previous value (flick)
            latchedRecord[field] = prevVec;
          } else {
            // Not active - use zero
            latchedRecord[field] = { x: 0, y: 0 };
          }
        }
      }
    }

    // Store state for next frame
    this.latchState.set(controllerId, {
      raw: rawInput,
      latched,
      lastRawHash: rawHash,
    });

    return latched;
  }
}

