import {
  platformMachineGameAnalyticsOverviewInputSchema,
  platformMachineGameAnalyticsOverviewSchema,
  platformMachineGameAnalyticsSessionsInputSchema,
  platformMachineGameAnalyticsSessionsSchema,
} from "@air-jam/sdk/platform-machine";
import {
  requestPlatformMachineApi,
  resolvePlatformMachineAuth,
} from "./platform-auth.js";

type GameAnalyticsOptions = {
  platformUrl?: string;
  token?: string;
  slugOrId: string;
};

export const getPlatformGameAnalyticsOverview = async ({
  platformUrl,
  token,
  slugOrId,
  days,
}: GameAnalyticsOptions & { days?: number }) => {
  const input = platformMachineGameAnalyticsOverviewInputSchema.parse({ days });
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });
  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/${encodeURIComponent(slugOrId)}/analytics?days=${input.days}`,
    token: resolved.token,
    schema: platformMachineGameAnalyticsOverviewSchema,
  });
};

export const getPlatformGameAnalyticsSessions = async ({
  platformUrl,
  token,
  slugOrId,
  limit,
}: GameAnalyticsOptions & { limit?: number }) => {
  const input = platformMachineGameAnalyticsSessionsInputSchema.parse({
    limit,
  });
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });
  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: `/api/cli/games/${encodeURIComponent(slugOrId)}/analytics/sessions?limit=${input.limit}`,
    token: resolved.token,
    schema: platformMachineGameAnalyticsSessionsSchema,
  });
};
