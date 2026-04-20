import {
  PLAYER_NAME_MIN_LENGTH,
  PLAYER_NAME_STORAGE_KEY,
} from "@/game/constants";
import { normalizePlayerName } from "@/game/domain/player-utils";
import { useGameStore } from "@/game/stores";
import { useAirJamController } from "@air-jam/sdk";
import { useState } from "react";

export const useControllerLobbyState = () => {
  const controller = useAirJamController();
  const controllerId = useAirJamController((state) => state.controllerId);
  const connectionStatus = useAirJamController(
    (state) => state.connectionStatus,
  );
  const phase = useGameStore((state) => state.phase);
  const playerOrder = useGameStore((state) => state.playerOrder);
  const readyByPlayerId = useGameStore((state) => state.readyByPlayerId);
  const actions = useGameStore.useActions();
  const [nameDraft, setNameDraft] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? "";
  });

  const isConnected = connectionStatus === "connected";
  const isReady = controllerId
    ? (readyByPlayerId[controllerId] ?? false)
    : false;
  const readyCount = playerOrder.filter(
    (playerId) => readyByPlayerId[playerId],
  ).length;
  const normalizedName = normalizePlayerName(nameDraft);
  const canReady = Boolean(isConnected && controllerId && phase === "lobby");
  const canReadyToggle = Boolean(
    canReady && (isReady || normalizedName.length >= PLAYER_NAME_MIN_LENGTH),
  );
  const canStartMatch =
    phase === "lobby" &&
    playerOrder.length > 0 &&
    readyCount === playerOrder.length;

  const commitPlayerName = () => {
    if (!controllerId) return;

    const nextName = normalizePlayerName(nameDraft);
    if (nextName.length < PLAYER_NAME_MIN_LENGTH) return;

    actions.setPlayerName({ name: nextName });
    controller.setNickname(nextName);
    setNameDraft(nextName);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, nextName);
    }
  };

  const toggleReady = () => {
    if (!canReadyToggle) return;
    if (!isReady) commitPlayerName();
    actions.setReady({ ready: !isReady });
  };

  return {
    canReadyToggle,
    canStartMatch,
    isReady,
    nameDraft,
    playerCount: playerOrder.length,
    readyCount,
    setNameDraft,
    startMatch: actions.startMatch,
    toggleReady,
  };
};
