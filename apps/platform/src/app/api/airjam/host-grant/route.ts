import { createHostGrant } from "@air-jam/sdk/protocol";
import { NextResponse, type NextRequest } from "next/server";
import { resolvePlatformDeploymentConfig } from "@/lib/platform-deployment-config";

const HOST_GRANT_TTL_SECONDS = 60;

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  const deploymentConfig = resolvePlatformDeploymentConfig(process.env);
  const appId =
    process.env.AIR_JAM_SYSTEM_APP_ID?.trim() || deploymentConfig.appId;
  const secret = process.env.AIR_JAM_HOST_GRANT_SECRET?.trim();
  const requestOrigin = request.headers.get("origin");

  if (!secret) {
    return jsonError("Host grant signing is not configured", 503);
  }

  if (!appId) {
    return jsonError("Platform Arcade App ID is not configured", 503);
  }

  if (requestOrigin && requestOrigin !== deploymentConfig.platformPublicOrigin) {
    return jsonError("Origin not allowed", 403);
  }

  const now = Math.floor(Date.now() / 1000);
  const hostGrant = await createHostGrant({
    secret,
    claims: {
      appId,
      iat: now,
      exp: now + HOST_GRANT_TTL_SECONDS,
      origins: [deploymentConfig.platformPublicOrigin],
    },
  });

  return NextResponse.json(
    { hostGrant },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
