import { type ConnectedPlayer } from "./types";

export const buildPlayerLabelMap = (
  players: ConnectedPlayer[],
): Record<string, string> => {
  return players.reduce<Record<string, string>>((labelById, player) => {
    labelById[player.id] = player.label;
    return labelById;
  }, {});
};

export const filterRecordByPlayerIds = <T>(
  record: Record<string, T>,
  activePlayerIds: string[],
): Record<string, T> => {
  const activeIdSet = new Set(activePlayerIds);

  return Object.entries(record).reduce<Record<string, T>>(
    (nextRecord, entry) => {
      const [playerId, value] = entry;

      if (activeIdSet.has(playerId)) {
        nextRecord[playerId] = value;
      }

      return nextRecord;
    },
    {},
  );
};
