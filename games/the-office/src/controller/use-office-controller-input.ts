import {
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { resolvePadDirection } from "./pad-direction";

const neutralInput = { movementX: 0, movementY: 0, action: false };

/** Owned by the active gameplay view; leaving it releases all held controls. */
export function useOfficeControllerInput({ busy }: { busy: boolean }) {
  const { socket } = useAirJamController();
  const writeInput = useInputWriter();
  const movement = useRef({ x: 0, y: 0 });
  const padPointer = useRef<number | null>(null);
  const workPointer = useRef<number | null>(null);
  const workKeys = useRef(new Set<string>());
  const [padDirection, setPadDirection] = useState({ x: 0, y: 0 });
  const originRef = useRef<HTMLSpanElement>(null);
  const rightRef = useRef<HTMLSpanElement>(null);
  const bottomRef = useRef<HTMLSpanElement>(null);

  const clear = useCallback(() => {
    movement.current = { x: 0, y: 0 };
    padPointer.current = null;
    workPointer.current = null;
    workKeys.current.clear();
    setPadDirection((previous) =>
      previous.x === 0 && previous.y === 0 ? previous : { x: 0, y: 0 },
    );
  }, []);

  const release = useCallback(() => {
    clear();
    if (socket?.connected) writeInput(neutralInput);
  }, [clear, socket, writeInput]);

  useEffect(() => {
    window.addEventListener("blur", release);
    const onVisibility = () => {
      if (document.hidden) release();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [release]);

  useControllerTick(
    () => {
      writeInput({
        movementX: busy ? 0 : movement.current.x,
        movementY: busy ? 0 : movement.current.y,
        action: workPointer.current !== null || workKeys.current.size > 0,
      });
    },
    { enabled: Boolean(socket?.connected), intervalMs: 16 },
  );

  const updatePad = (event: PointerEvent<HTMLDivElement>) => {
    const origin = originRef.current?.getBoundingClientRect();
    const right = rightRef.current?.getBoundingClientRect();
    const bottom = bottomRef.current?.getBoundingClientRect();
    const next =
      origin && right && bottom
        ? resolvePadDirection(
            { x: event.clientX, y: event.clientY },
            origin,
            right,
            bottom,
          )
        : { x: 0, y: 0 };
    movement.current = next;
    setPadDirection((previous) =>
      previous.x === next.x && previous.y === next.y ? previous : next,
    );
  };
  const endPad = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== padPointer.current) return;
    padPointer.current = null;
    movement.current = { x: 0, y: 0 };
    setPadDirection({ x: 0, y: 0 });
  };
  const endWork = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId === workPointer.current) workPointer.current = null;
  };
  const isWorkKey = (event: KeyboardEvent<HTMLButtonElement>) =>
    event.key === " " || event.key === "Enter";

  return {
    padDirection,
    originRef,
    rightRef,
    bottomRef,
    padBindings: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (
          !socket?.connected ||
          padPointer.current !== null ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        padPointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        updatePad(event);
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerId === padPointer.current) updatePad(event);
      },
      onPointerUp: endPad,
      onPointerCancel: endPad,
      onLostPointerCapture: endPad,
    },
    workBindings: {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (
          !socket?.connected ||
          workPointer.current !== null ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        workPointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerUp: endWork,
      onPointerCancel: endWork,
      onLostPointerCapture: endWork,
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!socket?.connected || !isWorkKey(event)) return;
        event.preventDefault();
        if (!event.repeat) workKeys.current.add(event.key);
      },
      onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!isWorkKey(event)) return;
        event.preventDefault();
        workKeys.current.delete(event.key);
      },
      onBlur: () => {
        workKeys.current.clear();
      },
    },
  };
}
