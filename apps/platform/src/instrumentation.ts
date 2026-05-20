import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    const railwayEnvironmentName = process.env.RAILWAY_ENVIRONMENT_NAME?.trim();
    const isRailwayPreviewEnvironment =
      Boolean(railwayEnvironmentName) &&
      railwayEnvironmentName !== "production";

    if (isRailwayPreviewEnvironment) {
      // Seed minimal preview data (test user + one listed game) so PR
      // previews have a usable arcade out of the box. Dynamic import
      // keeps production cold-start free of this code path entirely.
      try {
        const { seedPreviewData } = await import("./lib/seed-preview");
        await seedPreviewData();
      } catch (err) {
        // Seed failure should never block the server from coming up —
        // logs make it visible and the platform still works without it.
        console.warn(
          "[instrumentation] preview seed skipped:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
