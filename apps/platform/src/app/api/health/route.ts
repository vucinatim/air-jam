import {
  assessHostedReleaseOrigin,
  isHostedReleaseOriginRequired,
} from "@/lib/releases/hosted-release-origin";
import { NextResponse } from "next/server";

const readDeploymentIdentity = () => ({
  provider: process.env.RAILWAY_PROJECT_ID ? "railway" : null,
  environment: process.env.RAILWAY_ENVIRONMENT_NAME?.trim() || null,
  deploymentId: process.env.RAILWAY_DEPLOYMENT_ID?.trim() || null,
  revision:
    process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    null,
});

export function GET() {
  const releaseOrigin = assessHostedReleaseOrigin();
  const releaseOriginRequired = isHostedReleaseOriginRequired();
  const ok = !releaseOriginRequired || releaseOrigin.status === "ready";

  return NextResponse.json(
    {
      ok,
      service: "platform",
      deployment: readDeploymentIdentity(),
      boundaries: {
        hostedReleaseOrigin: {
          required: releaseOriginRequired,
          status: releaseOrigin.status,
          publicOrigin:
            releaseOrigin.status === "ready"
              ? releaseOrigin.publicOrigin
              : null,
          reason:
            releaseOrigin.status === "ready" ? null : releaseOrigin.reason,
        },
      },
    },
    { status: ok ? 200 : 503 },
  );
}
