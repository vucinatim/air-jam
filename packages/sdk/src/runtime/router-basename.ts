const AIR_JAM_LOCAL_GAME_PROXY_BASE_WINDOW_KEY =
  "__AIRJAM_LOCAL_GAME_PROXY_BASE__";

const normalizeBase = (value: string): string => {
  if (!value || value === "/") {
    return "/";
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
};

export const resolveAirJamBrowserRouterBasename = (): string => {
  if (typeof window === "undefined") {
    return "/";
  }

  const rawBase = Reflect.get(
    window,
    AIR_JAM_LOCAL_GAME_PROXY_BASE_WINDOW_KEY,
  );

  return typeof rawBase === "string" && rawBase.trim()
    ? normalizeBase(rawBase.trim())
    : "/";
};
