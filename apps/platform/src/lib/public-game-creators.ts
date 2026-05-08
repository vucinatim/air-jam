const githubProfileUrl = (handle: string): string => `https://github.com/${handle}`;

const githubAvatarUrl = (handle: string): string =>
  `https://github.com/${handle}.png?size=96`;

export interface PublicGameCreator {
  name: string;
  githubHandle?: string;
  githubUrl?: string;
  avatarUrl?: string;
  initials?: string;
}

export interface PublicGameAttribution {
  label?: string;
  creators: readonly PublicGameCreator[];
}

const timVucina: PublicGameCreator = {
  name: "Tim Vučina",
  githubHandle: "vucinatim",
  githubUrl: githubProfileUrl("vucinatim"),
  avatarUrl: githubAvatarUrl("vucinatim"),
  initials: "TV",
};

const zerodays: PublicGameCreator = {
  name: "zerodays",
  githubHandle: "zerodays",
  githubUrl: githubProfileUrl("zerodays"),
  avatarUrl: githubAvatarUrl("zerodays"),
  initials: "ZD",
};

/**
 * Keep this as the single edit surface for public game-card attribution until
 * the platform grows a real multi-creator field in game metadata/config.
 */
export const curatedPublicGameAttributions: Readonly<
  Record<string, PublicGameAttribution>
> = {
  "air-capture": {
    label: "Tim Vučina",
    creators: [timVucina],
  },
  pong: {
    label: "Tim Vučina",
    creators: [timVucina],
  },
  "code-review": {
    label: "Tim Vučina + zerodays",
    creators: [timVucina, zerodays],
  },
  "last-band-standing": {
    label: "Tim Vučina + zerodays",
    creators: [timVucina, zerodays],
  },
  "the-office": {
    label: "Tim Vučina + zerodays",
    creators: [timVucina, zerodays],
  },
};

const normalizePublicGameSlug = (
  slug: string | null | undefined,
): string | null => {
  const trimmed = slug?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith("local-") ? trimmed.slice("local-".length) : trimmed;
};

export const getCuratedPublicGameAttribution = (
  slug: string | null | undefined,
): PublicGameAttribution | null => {
  const normalizedSlug = normalizePublicGameSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  return curatedPublicGameAttributions[normalizedSlug] ?? null;
};
