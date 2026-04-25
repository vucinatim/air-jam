import {
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_MIN_LENGTH,
} from "@/game/constants";
import {
  getUniqueSongCountForBuckets,
  songBuckets,
  type SongBucketId,
} from "@/game/content/song-bank";
import { normalizePlayerName } from "@/game/domain/player-utils";
import { useGameStore } from "@/game/stores";
import { useAirJamController } from "@air-jam/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { playControllerHaptic } from "../haptics";

const PLAYER_NAME_PUSH_DEBOUNCE_MS = 350;

export const useControllerLobbyState = () => {
  const controller = useAirJamController();
  const controllerId = useAirJamController((state) => state.controllerId);
  const selfPlayer = useAirJamController((state) => state.selfPlayer);
  const connectionStatus = useAirJamController(
    (state) => state.connectionStatus,
  );
  const phase = useGameStore((state) => state.phase);
  const playerOrder = useGameStore((state) => state.playerOrder);
  const readyByPlayerId = useGameStore((state) => state.readyByPlayerId);
  const totalRounds = useGameStore((state) => state.totalRounds);
  const selectedSongBucketIds = useGameStore(
    (state) => state.selectedSongBucketIds,
  );
  const actions = useGameStore.useActions();
  const [nameDraft, setNameDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isConnected = connectionStatus === "connected";
  const isReady = controllerId
    ? (readyByPlayerId[controllerId] ?? false)
    : false;
  const readyCount = playerOrder.filter(
    (playerId) => readyByPlayerId[playerId],
  ).length;
  const profileName = normalizePlayerName(selfPlayer?.label ?? "");
  const activeName = normalizePlayerName(nameDraft || profileName);
  const canReady = Boolean(isConnected && controllerId && phase === "lobby");
  const canReadyToggle = Boolean(
    canReady && (isReady || activeName.length >= PLAYER_NAME_MIN_LENGTH),
  );
  const uniqueSongCount = getUniqueSongCountForBuckets(selectedSongBucketIds);
  const hasEnoughSongs = uniqueSongCount >= totalRounds;
  const selectedBucketCount = selectedSongBucketIds.length;
  const canStartMatch =
    phase === "lobby" &&
    playerOrder.length > 0 &&
    readyCount === playerOrder.length &&
    hasEnoughSongs;
  const startMatchHelper = hasEnoughSongs
    ? "Everyone is ready."
    : `Host needs ${totalRounds - uniqueSongCount} more unique songs.`;

  useEffect(() => {
    if (editingName) {
      return;
    }

    setNameDraft(profileName);
  }, [editingName, profileName]);

  useEffect(
    () => () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    },
    [],
  );

  const pushPlayerName = useCallback(
    (rawName: string): boolean => {
      if (!controllerId) return false;

      const nextName = normalizePlayerName(rawName);
      if (nextName.length < PLAYER_NAME_MIN_LENGTH) return false;

      controller.setNickname(nextName);
      if (nextName !== profileName) {
        void controller.updatePlayerProfile({ label: nextName });
      }
      setNameDraft(nextName);
      return true;
    },
    [controller, controllerId, profileName],
  );

  const clearPendingNamePush = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const schedulePlayerNamePush = useCallback(
    (rawName: string) => {
      clearPendingNamePush();

      if (normalizePlayerName(rawName).length < PLAYER_NAME_MIN_LENGTH) {
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        pushPlayerName(rawName);
      }, PLAYER_NAME_PUSH_DEBOUNCE_MS);
    },
    [clearPendingNamePush, pushPlayerName],
  );

  const updateNameDraft = useCallback(
    (rawName: string) => {
      const nextDraft = rawName.slice(0, PLAYER_NAME_MAX_LENGTH);
      setNameDraft(nextDraft);
      schedulePlayerNamePush(nextDraft);
    },
    [schedulePlayerNamePush],
  );

  const commitPlayerName = useCallback((): boolean => {
    clearPendingNamePush();
    return pushPlayerName(nameDraft);
  }, [clearPendingNamePush, nameDraft, pushPlayerName]);

  const blurNameInput = useCallback(() => {
    setEditingName(false);
    if (!commitPlayerName()) {
      setNameDraft(profileName);
    }
  }, [commitPlayerName, profileName]);

  const toggleReady = () => {
    if (!canReadyToggle) return;
    if (!isReady && !commitPlayerName()) return;
    playControllerHaptic(isReady ? "cancel" : "confirm");
    actions.setReady({ ready: !isReady });
  };

  const startMatch = () => {
    if (!canStartMatch) return;
    playControllerHaptic("confirm");
    actions.startMatch();
  };

  const toggleBucket = ({ bucketId }: { bucketId: SongBucketId }) => {
    if (phase !== "lobby") return;
    const isSelected = selectedSongBucketIds.includes(bucketId);
    playControllerHaptic(isSelected ? "cancel" : "confirm");
    actions.toggleSongBucket({ bucketId });
  };

  const bucketOptions = songBuckets.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    selected: selectedSongBucketIds.includes(bucket.id),
    songCount: getUniqueSongCountForBuckets([bucket.id]),
  }));

  return {
    bucketOptions,
    canReadyToggle,
    canStartMatch,
    canEditName: isConnected,
    canToggleBuckets: phase === "lobby",
    hasEnoughSongs,
    isReady,
    blurNameInput,
    focusNameInput: () => setEditingName(true),
    nameDraft,
    playerCount: playerOrder.length,
    readyCount,
    selectedBucketCount,
    startMatchHelper,
    startMatch,
    toggleBucket,
    toggleReady,
    totalRounds,
    uniqueSongCount,
    updateNameDraft,
  };
};
