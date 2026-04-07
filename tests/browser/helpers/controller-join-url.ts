import type { FrameLocator } from "@playwright/test";

interface ResolveControllerJoinUrlOptions {
  hostGame: FrameLocator;
  baseURL: string;
}

export const resolveControllerJoinUrl = async ({
  hostGame,
  baseURL,
}: ResolveControllerJoinUrlOptions): Promise<string> => {
  const hostRuntimeHref = await hostGame
    .locator("body")
    .evaluate(() => window.location.href);
  const runtimeUrl = new URL(hostRuntimeHref);
  const rawJoinUrl = runtimeUrl.searchParams.get("aj_join_url");

  if (!rawJoinUrl) {
    throw new Error("Host runtime URL did not include aj_join_url.");
  }

  const joinUrl = new URL(rawJoinUrl);
  const base = new URL(baseURL);
  joinUrl.protocol = base.protocol;
  joinUrl.host = base.host;

  return joinUrl.toString();
};
