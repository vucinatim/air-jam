/** What the room confirmed of a host's or phone's request to change a seat or the room. */
export type RoomActionAck =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** A profile change the room confirmed, with the seat's name and avatar as the room stored them. */
export type PlayerProfileAck =
  | {
      readonly ok: true;
      readonly profile: { readonly label: string; readonly avatarId?: string };
    }
  | { readonly ok: false; readonly message: string };

/**
 * Settles once the room shows the change (`confirmed`), or as unconfirmed
 * when the link stops being able to show it (`lost`); `follow` subscribes
 * to whatever might change either and returns its unsubscribe.
 */
export const awaitRoomConfirmation = ({
  follow,
  confirmed,
  lost,
  unconfirmed,
}: {
  follow: (changed: () => void) => () => void;
  confirmed: () => boolean;
  lost: () => boolean;
  unconfirmed: string;
}): Promise<RoomActionAck> =>
  new Promise((resolve) => {
    let settled = false;
    let stop: (() => void) | null = null;
    const check = () => {
      if (settled) return;
      const ok = confirmed();
      if (!ok && !lost()) return;
      settled = true;
      stop?.();
      resolve(ok ? { ok: true } : { ok: false, message: unconfirmed });
    };
    stop = follow(check);
    if (settled) stop();
  });
