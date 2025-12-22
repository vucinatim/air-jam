/**
 * @module useSendSignal
 * @description Lightweight hook for sending signals (haptics, toasts) without triggering re-renders.
 *
 * This hook is designed for components that need to send feedback signals to controllers
 * without subscribing to the connection store. Perfect for game objects that trigger
 * haptic feedback on collisions, pickups, or other events.
 *
 * **Supported signal types:**
 * - `HAPTIC` - Vibration patterns on the controller device
 * - `TOAST` - Visual notifications displayed on the controller
 *
 * **When to use this vs useAirJamHost().sendSignal:**
 * - Use `useSendSignal()` in components that render frequently (projectiles, collectibles)
 * - Use `useAirJamHost().sendSignal` when you already need other host state
 */
import { useCallback } from "react";
import { useAirJamContext } from "../context/air-jam-context";
import type {
  HapticSignalPayload,
  SignalPayload,
  SignalType,
  ToastSignalPayload,
} from "../protocol";

/**
 * Function signature for sending signals to controllers.
 *
 * Overloaded to provide proper typing for each signal type.
 */
export interface SendSignalFn {
  /**
   * Send haptic (vibration) feedback to a controller.
   *
   * @param type - Must be "HAPTIC"
   * @param payload - Haptic configuration with pattern
   * @param targetId - Controller ID (omit to send to all)
   *
   * @example Send heavy vibration to specific player
   * ```ts
   * sendSignal("HAPTIC", { pattern: "heavy" }, playerId);
   * ```
   *
   * @example Send custom vibration pattern to all
   * ```ts
   * sendSignal("HAPTIC", {
   *   pattern: "custom",
   *   sequence: [50, 100, 50, 100, 200],
   * });
   * ```
   */
  (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;

  /**
   * Send a toast notification to a controller.
   *
   * @param type - Must be "TOAST"
   * @param payload - Toast content with title and message
   * @param targetId - Controller ID (omit to send to all)
   *
   * @example Send achievement notification
   * ```ts
   * sendSignal("TOAST", {
   *   title: "Achievement Unlocked!",
   *   message: "First blood",
   *   variant: "success",
   * }, playerId);
   * ```
   */
  (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
}

/**
 * Lightweight hook for sending signals without store subscriptions.
 *
 * Returns a stable `sendSignal` function that can send haptic feedback
 * or toast notifications to controllers. Unlike `useAirJamHost()`, this
 * hook does NOT subscribe to the store, preventing re-renders.
 *
 * **Haptic patterns:**
 * - `light` - Quick tap (10ms)
 * - `medium` - Standard vibration (30ms)
 * - `heavy` - Strong pulse pattern
 * - `success` - Short double tap
 * - `failure` - Rapid pulses
 * - `custom` - Custom sequence array
 *
 * @returns A stable sendSignal function
 *
 * @example In a collision handler
 * ```tsx
 * const Laser = ({ ownerId }: { ownerId: string }) => {
 *   const sendSignal = useSendSignal();
 *
 *   const handleHit = (targetId: string) => {
 *     // Vibrate the player who got hit
 *     sendSignal("HAPTIC", { pattern: "heavy" }, targetId);
 *
 *     // Light vibration for the shooter
 *     sendSignal("HAPTIC", { pattern: "light" }, ownerId);
 *   };
 *
 *   // ... collision detection logic
 * };
 * ```
 *
 * @example For collectible pickups
 * ```tsx
 * const Collectible = () => {
 *   const sendSignal = useSendSignal();
 *
 *   const handleCollect = (playerId: string) => {
 *     sendSignal("HAPTIC", { pattern: "success" }, playerId);
 *     sendSignal("TOAST", {
 *       title: "+10 Points",
 *       variant: "default",
 *     }, playerId);
 *   };
 * };
 * ```
 *
 * @example Game-wide announcements
 * ```tsx
 * const GameManager = () => {
 *   const sendSignal = useSendSignal();
 *
 *   const announceRoundStart = () => {
 *     // No targetId = broadcast to all controllers
 *     sendSignal("TOAST", {
 *       title: "Round Start!",
 *       message: "Get ready to fight",
 *       variant: "default",
 *     });
 *   };
 * };
 * ```
 */
export const useSendSignal = (): SendSignalFn => {
  const { getSocket } = useAirJamContext();

  // Get socket directly without subscribing to store state
  // The socket reference is stable from SocketManager
  const sendSignal = useCallback(
    (
      type: SignalType,
      payload: HapticSignalPayload | ToastSignalPayload,
      targetId?: string,
    ): void => {
      const socket = getSocket("host");
      if (!socket || !socket.connected) {
        return;
      }
      const signal: SignalPayload = {
        targetId,
        type,
        payload,
      } as SignalPayload;
      socket.emit("host:signal", signal);
    },
    [getSocket],
  ) as SendSignalFn;

  return sendSignal;
};
