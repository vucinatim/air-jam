import type { DeploymentEnvironment } from "@air-jam/operations-contract";

export const resolveOperationalEnvironment = (
  env: Record<string, string | undefined> = process.env,
): DeploymentEnvironment => {
  const explicit = env.AIRJAM_OPERATIONAL_ENVIRONMENT?.trim();
  if (
    explicit === "production" ||
    explicit === "preview" ||
    explicit === "development" ||
    explicit === "test"
  ) {
    return explicit;
  }
  const railway = env.RAILWAY_ENVIRONMENT_NAME?.trim();
  if (railway === "production") return "production";
  if (railway) return "preview";
  return env.NODE_ENV === "test" ? "test" : "development";
};
