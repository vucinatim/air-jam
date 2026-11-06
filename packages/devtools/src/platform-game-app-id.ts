import {
  platformMachineGameAppIdOriginsInputSchema,
  platformMachineGameAppIdRegenerateInputSchema,
  platformMachineGameAppIdSchema,
  platformMachineGameSlugAvailabilityInputSchema,
  platformMachineGameSlugAvailabilitySchema,
} from "@air-jam/sdk/platform-machine";
import {
  requestPlatformMachineApi,
  resolvePlatformMachineAuth,
} from "./platform-auth.js";

type GameAppIdOptions = {
  platformUrl?: string;
  token?: string;
  slugOrId: string;
};

export const inspectPlatformGameAppId = async ({
  platformUrl,
  token,
  slugOrId,
}: GameAppIdOptions) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });
  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/${encodeURIComponent(slugOrId)}/app-id`,
    token: resolved.token,
    schema: platformMachineGameAppIdSchema,
  });
};

export const updatePlatformGameAppIdOrigins = async ({
  platformUrl,
  token,
  slugOrId,
  allowedOrigins,
}: GameAppIdOptions & { allowedOrigins: string[] }) => {
  const input = platformMachineGameAppIdOriginsInputSchema.parse({
    allowedOrigins,
  });
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });
  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/${encodeURIComponent(slugOrId)}/app-id/origins`,
    method: "POST",
    token: resolved.token,
    body: input,
    schema: platformMachineGameAppIdSchema,
  });
};

export const regeneratePlatformGameAppId = async ({
  platformUrl,
  token,
  slugOrId,
  yes,
}: GameAppIdOptions & { yes?: boolean }) => {
  if (!yes)
    throw new Error(
      "Regenerating the App ID breaks deployed games. Pass --yes to confirm.",
    );
  const input = platformMachineGameAppIdRegenerateInputSchema.parse({ yes });
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });
  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/${encodeURIComponent(slugOrId)}/app-id/regenerate`,
    method: "POST",
    token: resolved.token,
    body: input,
    schema: platformMachineGameAppIdSchema,
  });
};

export const checkPlatformGameSlugAvailability = async ({
  platformUrl,
  token,
  slug,
  game,
}: {
  platformUrl?: string;
  token?: string;
  slug: string;
  game?: string;
}) => {
  const input = platformMachineGameSlugAvailabilityInputSchema.parse({
    slug,
    game,
  });
  const query = new URLSearchParams({ slug: input.slug });
  if (input.game !== undefined) query.set("game", input.game);
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });
  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/slug-availability?${query}`,
    token: resolved.token,
    schema: platformMachineGameSlugAvailabilitySchema,
  });
};
