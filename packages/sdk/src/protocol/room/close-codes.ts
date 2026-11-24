/**
 * Why a room closed a connection. A terminal reason tells the client not to
 * reconnect; any other close, including one with a code missing from this
 * table such as a lost network, is retried with backoff.
 */
export const roomCloseCodes = {
  replaced: { code: 4000, terminal: true },
  removed: { code: 4001, terminal: true },
  left: { code: 4002, terminal: true },
  closed: { code: 4003, terminal: true },
  "not-found": { code: 4004, terminal: true },
  full: { code: 4005, terminal: true },
  unauthorised: { code: 4006, terminal: true },
  "unsupported-version": { code: 4007, terminal: true },
  "limits-broken": { code: 4008, terminal: true },
  restarting: { code: 4100, terminal: false },
  "try-later": { code: 4101, terminal: false },
} as const satisfies Record<string, { code: number; terminal: boolean }>;

export type RoomCloseReason = keyof typeof roomCloseCodes;

export const roomCloseReasonForCode = (
  code: number,
): RoomCloseReason | null => {
  for (const [reason, entry] of Object.entries(roomCloseCodes))
    if (entry.code === code) return reason as RoomCloseReason;
  return null;
};

export const isTerminalRoomClose = (code: number): boolean => {
  const reason = roomCloseReasonForCode(code);
  return reason !== null && roomCloseCodes[reason].terminal;
};
