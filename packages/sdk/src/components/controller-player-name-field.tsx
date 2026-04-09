import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAirJamController } from "../hooks/use-air-jam-controller";
import { cn } from "../utils/cn";

const LABEL_MAX = 24;
const DEFAULT_DEBOUNCE_MS = 400;

export type ControllerPlayerNameFieldProps = {
  /** Screen-reader / visible label copy */
  fieldLabel?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  debounceMs?: number;
};

/**
 * Edits the live room player display name. While connected, changes are sent with
 * {@link AirJamControllerApi.updatePlayerProfile} (debounced) and broadcast to the room via
 * `server:playerUpdated`. Also updates the nickname draft for the next join.
 */
export const ControllerPlayerNameField = ({
  fieldLabel = "Your name",
  className,
  labelClassName,
  inputClassName,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: ControllerPlayerNameFieldProps): JSX.Element => {
  const controller = useAirJamController();
  const [local, setLocal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(controller.selfPlayer?.label?.trim() ?? "");
  }, [controller.controllerId]);

  useEffect(() => {
    if (inputRef.current === document.activeElement) {
      return;
    }
    setLocal(controller.selfPlayer?.label?.trim() ?? "");
  }, [controller.selfPlayer?.label]);

  useEffect(
    () => () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    },
    [],
  );

  const pushRoomName = useCallback(
    (raw: string) => {
      const trimmed = raw.trim().slice(0, LABEL_MAX);
      if (trimmed.length < 1) {
        return;
      }
      controller.setNickname(trimmed);
      void controller.updatePlayerProfile({ label: trimmed });
    },
    [controller],
  );

  const schedulePush = useCallback(
    (raw: string) => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        pushRoomName(raw);
      }, debounceMs);
    },
    [debounceMs, pushRoomName],
  );

  const connected = controller.connectionStatus === "connected";

  return (
    <div className={cn("min-w-0", className)}>
      <label className={cn("mb-1 block", labelClassName)} htmlFor="airjam-controller-player-name">
        {fieldLabel}
      </label>
      <input
        ref={inputRef}
        id="airjam-controller-player-name"
        type="text"
        name="airjam-controller-player-name"
        autoComplete="nickname"
        enterKeyHint="done"
        maxLength={LABEL_MAX}
        disabled={!connected}
        value={local}
        placeholder={connected ? "Enter name" : "Connect to edit"}
        className={cn(inputClassName)}
        onChange={(event) => {
          const next = event.target.value.slice(0, LABEL_MAX);
          setLocal(next);
          schedulePush(next);
        }}
        onBlur={() => {
          if (debounceTimerRef.current !== null) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
          const trimmed = local.trim();
          if (trimmed.length < 1) {
            setLocal(controller.selfPlayer?.label?.trim() ?? "");
            return;
          }
          pushRoomName(local);
        }}
      />
    </div>
  );
};
