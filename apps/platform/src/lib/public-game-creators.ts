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

const timKalan: PublicGameCreator = {
  name: "Tim Kalan",
  githubHandle: "timkalan",
  githubUrl: githubProfileUrl("timkalan"),
  avatarUrl: githubAvatarUrl("timkalan"),
  initials: "TK",
};

const domenKoscak: PublicGameCreator = {
  name: "Domen Koščak",
  githubHandle: "domenkoscak",
  githubUrl: githubProfileUrl("domenkoscak"),
  avatarUrl: githubAvatarUrl("domenkoscak"),
  initials: "DK",
};

const vaneSkubic: PublicGameCreator = {
  name: "Vane Skubic",
  githubHandle: "VaneSkubic",
  githubUrl: githubProfileUrl("VaneSkubic"),
  avatarUrl: githubAvatarUrl("VaneSkubic"),
  initials: "VS",
};

const zigApk: PublicGameCreator = {
  name: "Žiga Pk",
  githubHandle: "zigapk",
  githubUrl: githubProfileUrl("zigapk"),
  avatarUrl: githubAvatarUrl("zigapk"),
  initials: "ŽP",
};

const mihaMajetic: PublicGameCreator = {
  name: "Miha Majetić",
  githubHandle: "mihamajetic",
  githubUrl: githubProfileUrl("mihamajetic"),
  avatarUrl: githubAvatarUrl("mihamajetic"),
  initials: "MM",
};

const matejM: PublicGameCreator = {
  name: "Matej M",
  githubHandle: "matejm",
  githubUrl: githubProfileUrl("matejm"),
  avatarUrl: githubAvatarUrl("matejm"),
  initials: "MM",
};

const drobilc: PublicGameCreator = {
  name: "Drobilc",
  githubHandle: "drobilc",
  githubUrl: githubProfileUrl("drobilc"),
  avatarUrl: githubAvatarUrl("drobilc"),
  initials: "DR",
};

const spelaBuh: PublicGameCreator = {
  name: "Špela Buh",
  initials: "ŠB",
};

/**
 * Keep this as the single edit surface for public game-card attribution until
 * the platform grows a real multi-creator field in game metadata/config.
 */
export const curatedPublicGameAttributions: Readonly<
  Record<string, PublicGameAttribution>
> = {
  "air-capture": {
    label: "AirJam",
    creators: [timVucina],
  },
  pong: {
    label: "AirJam",
    creators: [timVucina],
  },
  "code-review": {
    label: "AirJam + zerodays",
    creators: [mihaMajetic, zigApk, timKalan],
  },
  "last-band-standing": {
    label: "AirJam + zerodays",
    creators: [timVucina, vaneSkubic, domenKoscak],
  },
  "the-office": {
    label: "AirJam + zerodays",
    creators: [matejM, spelaBuh, drobilc],
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
