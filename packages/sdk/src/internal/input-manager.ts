/**
 * @module InputManager
 * @description Internal class for managing controller input with validation and latching.
 *
 * The InputManager is created internally by the AirJamProvider when input configuration
 * is provided. It handles:
 *
 * 1. **Input Buffering** - Stores the latest input for each controller
 * 2. **Validation** - Validates input against a Zod schema (optional)
 * 3. **Latching** - Ensures rapid button presses and stick flicks are never missed
 *
 * ## What is Latching?
 *
 * Game loops typically run at 60fps, but network events may arrive between frames.
 * Without latching, a quick button tap might be missed if it starts and ends between
 * two consecutive `getInput()` calls.
 *
 * **Latching solves this by:**
 * - Boolean fields: Keeping `true` values until consumed
 * - Vector fields: Keeping non-zero values for one frame after release
 *
 * ## Example: Without Latching (Bug)
 * ```
 * Frame 1: getInput() → action: false
 * [Network: action: true arrives, then action: false arrives]
 * Frame 2: getInput() → action: false ← Tap missed!
 * ```
 *
 * ## Example: With Latching (Fixed)
 * ```
 * Frame 1: getInput() → action: false
 * [Network: action: true arrives, then action: false arrives]
 * Frame 2: getInput() → action: true  ← Tap captured!
 * Frame 3: getInput() → action: false ← Consumed, resets
 * ```
 *
 * @internal This class is not exported publicly. Use hooks to access input.
 */
import type { z } from "zod";
import type { ControllerInputEvent } from "../protocol";

/**
 * Configuration for input handling with optional validation and latching.
 *
 * Provided to `AirJamProvider` to enable typed, validated, and latched input.
 *
 * @template TSchema - Zod schema type for input validation
 *
 * @example Basic schema validation
 * ```ts
 * const config: InputConfig = {
 *   schema: z.object({
 *     vector: z.object({ x: z.number(), y: z.number() }),
 *     action: z.boolean(),
 *   }),
 * };
 * ```
 *
 * @example With latching for button and stick
 * ```ts
 * const config: InputConfig = {
 *   schema: gameInputSchema,
 *   latch: {
 *     booleanFields: ["action", "ability", "jump"],
 *     vectorFields: ["vector", "aim"],
 *   },
 * };
 * ```
 */
export interface InputConfig<TSchema extends z.ZodSchema = z.ZodSchema> {
  /**
   * Zod schema for input validation and type inference.
   *
   * When provided:
   * - Incoming input is validated against the schema
   * - Invalid input returns `undefined` (with console warning)
   * - Return type is inferred from the schema
   *
   * @example
   * ```ts
   * schema: z.object({
   *   vector: z.object({ x: z.number(), y: z.number() }),
   *   action: z.boolean(),
   *   ability: z.boolean(),
   *   timestamp: z.number(),
   * })
   * ```
   */
  schema?: TSchema;
  /**
   * Latching configuration to ensure rapid taps and flicks are never missed.
   *
   * Latching "holds" boolean true values and non-zero vectors until the next
   * `getInput()` call, preventing missed inputs between game frames.
   */
  latch?: {
    /**
     * Boolean field names that should be latched.
     *
     * When a boolean field is latched:
     * - If it becomes `true`, it stays `true` until consumed by `getInput()`
     * - After consumption, it resets to the actual current value
     *
     * Use for: buttons, triggers, action inputs
     *
     * @example ["action", "ability", "jump", "fire"]
     */
    booleanFields?: string[];
    /**
     * Vector field names that should be latched.
     *
     * When a vector field is latched:
     * - Non-zero vectors are kept for one frame after returning to zero
     * - Ensures quick stick flicks register in the game loop
     *
     * Use for: joysticks, d-pads, directional inputs
     *
     * @example ["vector", "movement", "aim"]
     */
    vectorFields?: string[];
  };
}

/**
 * Internal state for tracking latch values per controller.
 * @internal
 */
interface LatchState<TInput = Record<string, unknown>> {
  /** The most recent raw input from the controller */
  raw: TInput;
  /** The latched input (with consumed values held) */
  latched: TInput;
  /** Hash of raw input to detect changes */
  lastRawHash?: string;
}

/**
 * Internal class that manages input buffering, validation, and latching.
 *
 * Created automatically by `AirJamProvider` when input configuration is provided.
 * Access input via `useGetInput()` or `useAirJamHost().getInput()`.
 *
 * @template TSchema - Zod schema type for input validation
 *
 * @internal Not exported publicly. Use hooks to access input.
 *
 * @example How it's used internally
 * ```ts
 * // In AirJamProvider
 * const inputManager = new InputManager({
 *   schema: gameInputSchema,
 *   latch: { booleanFields: ["action"] },
 * });
 *
 * // In useAirJamHost (socket handler)
 * socket.on("server:input", (payload) => {
 *   inputManager.handleInput(payload);
 * });
 *
 * // In game loop (via useGetInput)
 * const input = inputManager.getInput(playerId);
 * ```
 */
export class InputManager<TSchema extends z.ZodSchema = z.ZodSchema> {
  private inputBuffer = new Map<string, Record<string, unknown>>();
  private latchState = new Map<string, LatchState>();
  private config: InputConfig<TSchema>;

  constructor(config: InputConfig<TSchema> = {}) {
    this.config = config;
  }

  /**
   * Handles incoming input events from the socket.
   * Should be called when 'server:input' event is received.
   */
  handleInput(payload: ControllerInputEvent): void {
    // Note: We don't filter by roomId here because:
    // 1. The server already routes input correctly to the right host
    // 2. Multiple host instances might share the same InputManager instance
    // 3. The roomId check was causing false rejections when hosts re-register

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
          result.error,
        );
        return undefined;
      }
      validatedInput = result.data as Record<string, unknown>;
    }

    // Apply latching if configured
    if (this.config.latch) {
      return this.getLatched(
        controllerId,
        validatedInput as Record<string, unknown>,
      ) as z.infer<TSchema>;
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
