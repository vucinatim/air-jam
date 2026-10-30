import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { ControllerInput } from "../core/controller-input";
import type {
  AirJamAxisControl,
  AirJamButtonControl,
  AirJamStickControl,
  AirJamVector,
} from "../core/input";
import { createAirJamDiagnosticError } from "../diagnostics";
import type { AirJamControllerRuntimeControls } from "../hooks/use-air-jam-controller";
import { controllerRuntimeContext } from "../runtime/runtime-owner-contexts";
import { cn } from "../utils/cn";

const useControllerInput = (): ControllerInput => {
  const runtime = useContext(
    controllerRuntimeContext,
  ) as AirJamControllerRuntimeControls | null;
  if (!runtime?.input)
    throw createAirJamDiagnosticError(
      "AJ_INPUT_NOT_DECLARED",
      "Phone controls send declared controls. Declare them with defineAirJamGame({ input }) and render controls inside <airjam.Controller>.",
    );
  return runtime.input;
};

const capturePointer = (event: PointerEvent<Element>): void => {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // A pointer that already ended can no longer be captured; the press still counts.
  }
};

const isPressKey = (event: KeyboardEvent): boolean =>
  event.key === " " || event.key === "Enter";

/** Holds something for as long as one pointer or key stays down on the element. */
const usePress = (
  start: () => () => void,
  disabled: boolean,
  onActiveChange: ((active: boolean) => void) | undefined,
) => {
  const release = useRef<(() => void) | null>(null);
  const pointer = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const onActiveChangeRef = useRef(onActiveChange);
  useEffect(() => {
    onActiveChangeRef.current = onActiveChange;
  });
  const begin = useCallback(() => {
    if (release.current) return false;
    release.current = start();
    setActive(true);
    onActiveChangeRef.current?.(true);
    return true;
  }, [start]);
  const end = useCallback(() => {
    pointer.current = null;
    if (!release.current) return;
    release.current();
    release.current = null;
    setActive(false);
    onActiveChangeRef.current?.(false);
  }, []);
  useEffect(() => {
    if (disabled) end();
  }, [disabled, end]);
  useEffect(() => end, [end]);
  const endPointer = (event: PointerEvent) => {
    if (event.pointerId === pointer.current) end();
  };
  return {
    active,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (disabled || event.button !== 0 || !begin()) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        capturePointer(event);
      },
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onLostPointerCapture: endPointer,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (disabled || !isPressKey(event)) return;
        event.preventDefault();
        if (!event.repeat) begin();
      },
      onKeyUp: (event: KeyboardEvent<HTMLElement>) => {
        if (!isPressKey(event)) return;
        event.preventDefault();
        end();
      },
      // Focus leaving ends a key hold; a finger still down keeps its press.
      onBlur: () => {
        if (pointer.current === null) end();
      },
      onContextMenu: (event: MouseEvent<HTMLElement>) => event.preventDefault(),
    },
  };
};

type PressableProps = Omit<
  ComponentProps<"button">,
  | "type"
  | "onPointerDown"
  | "onPointerUp"
  | "onPointerCancel"
  | "onLostPointerCapture"
  | "onKeyDown"
  | "onKeyUp"
  | "onBlur"
  | "onContextMenu"
> & {
  /** Called when the control starts and stops being held, such as for haptics. */
  onActiveChange?: (active: boolean) => void;
};

export interface ControlButtonProps extends PressableProps {
  control: AirJamButtonControl;
}

/**
 * A phone button bound to a declared button. Each touch is one press and the
 * button stays down while held; `data-active` styles the held state.
 */
export const ControlButton = ({
  control,
  disabled = false,
  onActiveChange,
  className,
  ...props
}: ControlButtonProps) => {
  const input = useControllerInput();
  const press = useCallback(
    () => input.press(control.name),
    [input, control.name],
  );
  const { active, handlers } = usePress(press, disabled, onActiveChange);
  return (
    <button
      type="button"
      {...props}
      {...handlers}
      disabled={disabled}
      data-active={active}
      className={cn("touch-none select-none", className)}
    />
  );
};

export interface AxisButtonProps extends PressableProps {
  control: AirJamAxisControl;
  /** The axis value while held, from -1 to 1. */
  value: number;
}

/**
 * A phone button that holds a declared axis at `value`, such as a paddle's
 * up and down buttons. The latest held button wins.
 */
export const AxisButton = ({
  control,
  value,
  disabled = false,
  onActiveChange,
  className,
  ...props
}: AxisButtonProps) => {
  const input = useControllerInput();
  const hold = useCallback(
    () => input.hold(control.name, value),
    [input, control.name, value],
  );
  const { active, handlers } = usePress(hold, disabled, onActiveChange);
  return (
    <button
      type="button"
      {...props}
      {...handlers}
      disabled={disabled}
      data-active={active}
      className={cn("touch-none select-none", className)}
    />
  );
};

interface Point {
  x: number;
  y: number;
}

const centre = (element: Element | null): Point | null => {
  const rect = element?.getBoundingClientRect();
  return rect
    ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    : null;
};

/**
 * Where a pointer is within the stick, from three corner markers, so the
 * stick reads correctly however its surface is rotated or scaled.
 */
const resolveStickPoint = (
  point: Point,
  origin: Point,
  right: Point,
  bottom: Point,
): AirJamVector => {
  const xAxis = { x: right.x - origin.x, y: right.y - origin.y };
  const yAxis = { x: bottom.x - origin.x, y: bottom.y - origin.y };
  const determinant = xAxis.x * yAxis.y - xAxis.y * yAxis.x;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 0.001)
    return { x: 0, y: 0 };
  const offset = { x: point.x - origin.x, y: point.y - origin.y };
  const across = (offset.x * yAxis.y - offset.y * yAxis.x) / determinant;
  const down = (xAxis.x * offset.y - xAxis.y * offset.x) / determinant;
  return { x: 2 * across - 1, y: 2 * down - 1 };
};

const shapeStick = (
  vector: AirJamVector,
  directions: "any" | "4-way",
  deadzone: number,
): AirJamVector => {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= deadzone) return { x: 0, y: 0 };
  if (directions === "4-way")
    return Math.abs(vector.x) > Math.abs(vector.y)
      ? { x: Math.sign(vector.x), y: 0 }
      : { x: 0, y: Math.sign(vector.y) };
  return length > 1 ? { x: vector.x / length, y: vector.y / length } : vector;
};

const CENTRE: AirJamVector = { x: 0, y: 0 };

export interface StickProps extends Omit<
  ComponentProps<"div">,
  | "children"
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
  | "onPointerCancel"
  | "onLostPointerCapture"
> {
  control: AirJamStickControl;
  /** `"4-way"` snaps to up, down, left or right, like a pad. */
  directions?: "any" | "4-way";
  /** Distance from the centre, from 0 to 1, that still reads as centred. */
  deadzone?: number;
  disabled?: boolean;
  /** Classes for the knob that follows the stick. */
  knobClassName?: string;
  /** Content inside the knob. */
  knob?: ReactNode;
  /** Drawn inside the stick; a function draws the whole stick instead of the knob. */
  children?:
    | ReactNode
    | ((state: { value: AirJamVector; active: boolean }) => ReactNode);
  onActiveChange?: (active: boolean) => void;
}

/**
 * A phone stick bound to a declared stick: drag anywhere inside it. Down is
 * positive y, as on a gamepad. `data-active` styles the dragged state.
 */
export const Stick = ({
  control,
  directions = "any",
  deadzone = 0,
  disabled = false,
  knobClassName,
  knob,
  children,
  onActiveChange,
  className,
  ...props
}: StickProps) => {
  const input = useControllerInput();
  const origin = useRef<HTMLSpanElement>(null);
  const right = useRef<HTMLSpanElement>(null);
  const bottom = useRef<HTMLSpanElement>(null);
  const pointer = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const subscribe = useCallback(
    (listener: () => void) => input.subscribe(listener),
    [input],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => input.value(control.name) as AirJamVector,
    () => CENTRE,
  );
  const setActiveState = (next: boolean) => {
    setActive(next);
    onActiveChange?.(next);
  };
  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const corners = [origin, right, bottom].map(({ current }) =>
      centre(current),
    );
    const [topLeft, topRight, bottomLeft] = corners;
    if (!topLeft || !topRight || !bottomLeft) return;
    input.set(
      control.name,
      shapeStick(
        resolveStickPoint(
          { x: event.clientX, y: event.clientY },
          topLeft,
          topRight,
          bottomLeft,
        ),
        directions,
        deadzone,
      ),
    );
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointer.current) return;
    pointer.current = null;
    input.set(control.name, CENTRE);
    setActiveState(false);
  };
  useEffect(() => {
    if (!disabled || pointer.current === null) return;
    pointer.current = null;
    input.set(control.name, CENTRE);
    setActive(false);
  }, [disabled, input, control.name]);
  const marker = "pointer-events-none absolute size-0";
  return (
    <div
      {...props}
      data-active={active}
      className={cn("relative touch-none select-none", className)}
      onPointerDown={(event) => {
        if (disabled || pointer.current !== null || event.button !== 0) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        capturePointer(event);
        setActiveState(true);
        follow(event);
      }}
      onPointerMove={(event) => {
        if (event.pointerId === pointer.current) follow(event);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span ref={origin} className={cn(marker, "top-0 left-0")} />
      <span ref={right} className={cn(marker, "top-0 left-full")} />
      <span ref={bottom} className={cn(marker, "top-full left-0")} />
      {typeof children === "function" ? (
        children({ value, active })
      ) : (
        <>
          {children}
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 left-1/2 flex size-1/3 items-center justify-center rounded-full bg-current/30",
              !active && "transition-transform duration-150 ease-out",
              knobClassName,
            )}
            style={{
              transform: `translate(calc(-50% + ${value.x * 100}%), calc(-50% + ${value.y * 100}%))`,
            }}
          >
            {knob}
          </span>
        </>
      )}
    </div>
  );
};
