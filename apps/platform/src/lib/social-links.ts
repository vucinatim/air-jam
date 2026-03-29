/** Public Air Jam repo (navbar, footer). */
export const airJamGithubRepoUrl = "https://github.com/vucinatim/air-jam";

/**
 * Community Discord invite. Override with `NEXT_PUBLIC_DISCORD_INVITE`, or edit
 * the fallback when the public invite URL is ready.
 */
const discordInviteFallback = "https://discord.gg/air-jam";

export const airJamDiscordInviteUrl =
  process.env.NEXT_PUBLIC_DISCORD_INVITE?.trim() || discordInviteFallback;
