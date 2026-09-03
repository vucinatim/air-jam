import { resolvePlatformDeploymentConfig } from "@/lib/platform-deployment-config";
import { readPlatformDeploymentIdentity } from "@/lib/platform-service-contract";
import {
  assessHostedReleaseOrigin,
  isHostedReleaseOriginRequired,
} from "@/lib/releases/hosted-release-origin";
import { NextResponse } from "next/server";

export function GET() {
  const deployment = resolvePlatformDeploymentConfig();
  const releaseOrigin = assessHostedReleaseOrigin();
  const releaseOriginRequired = isHostedReleaseOriginRequired();
  const ok = !releaseOriginRequired || releaseOrigin.status === "ready";

  return NextResponse.json(
    {
      ok,
      service: "platform",
      deployment: readPlatformDeploymentIdentity(),
      boundaries: {
        platformRequestPolicy: {
          platformPublicOrigin: deployment.platformPublicOrigin,
          isRailwayPreviewEnvironment: deployment.isRailwayPreviewEnvironment,
          platformRequestHosts: deployment.platformRequestHosts,
        },
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
