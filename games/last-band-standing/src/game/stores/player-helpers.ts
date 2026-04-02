import { isGenericPlayerLabel } from "@/utils/player-utils";
import { type ConnectedPlayer } from "./types";

export const buildPlayerLabelMap = (
  players: ConnectedPlayer[],
): Record<string, string> => {
  return players.reduce<Record<string, string>>((labelById, player) => {
    labelById[player.id] = player.label;
    return labelById;
  }, {});
};

export const buildNextPlayerLabelMap = (
  nextPlayerOrder: string[],
  incomingLabelById: Record<string, string>,
  existingLabelById: Record<string, string>,
): Record<string, string> => {
  return nextPlayerOrder.reduce<Record<string, string>>((nextLabelById, playerId) => {
    const existingLabel = existingLabelById[playerId];
    const incomingLabel = incomingLabelById[playerId] ?? `Player ${playerId.slice(0, 4)}`;

    if (!existingLabel) {
      nextLabelById[playerId] = incomingLabel;
      return nextLabelById;
    }

    if (isGenericPlayerLabel(existingLabel) && !isGenericPlayerLabel(incomingLabel)) {
      nextLabelById[playerId] = incomingLabel;
      return nextLabelById;
    }

    nextLabelById[playerId] = existingLabel;
    return nextLabelById;
  }, {});
};

export const filterRecordByPlayerIds = <T>(
  record: Record<string, T>,
  activePlayerIds: string[],
): Record<string, T> => {
  const activeIdSet = new Set(activePlayerIds);

  return Object.entries(record).reduce<Record<string, T>>((nextRecord, entry) => {
    const [playerId, value] = entry;

    if (activeIdSet.has(playerId)) {
      nextRecord[playerId] = value;
    }

    return nextRecord;
  }, {});
};
