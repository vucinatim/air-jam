import { createHash } from "node:crypto";

/**
 * Better-auth needs a stable secret to sign sessions. Production sets
 * BETTER_AUTH_SECRET explicitly. Railway PR previews would otherwise
 * fall back to better-auth's auto-generated default, which rotates on
 * every container restart and floods logs with warnings.
 *
 * Derive a deterministic per-preview secret instead: stable across
 * restarts within one PR environment, isolated from production, no
 * Railway-side config required.
 *
 * Returns undefined for local dev so better-auth's normal "set
 * BETTER_AUTH_SECRET" warning still fires — that warning is useful
 * locally, just not on previews.
 */
export const resolveAuthSecret = ({
  env,
  isRailwayPreviewEnvironment,
}: {
  env: NodeJS.ProcessEnv;
  isRailwayPreviewEnvironment: boolean;
}): string | undefined => {
  const explicit = env.BETTER_AUTH_SECRET?.trim();
  if (explicit) {
    return explicit;
  }
  if (isRailwayPreviewEnvironment) {
    const envName = env.RAILWAY_ENVIRONMENT_NAME?.trim() ?? "preview";
    return createHash("sha256")
      .update(`airjam-preview:${envName}`)
      .digest("hex");
  }
  return undefined;
};
