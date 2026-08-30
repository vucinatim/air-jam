import {
  assessHostedReleaseOrigin,
  isHostedReleaseOriginRequired,
} from "@/lib/releases/hosted-release-origin";
import { NextResponse } from "next/server";

export function GET() {
  const releaseOrigin = assessHostedReleaseOrigin();
  const releaseOriginRequired = isHostedReleaseOriginRequired();
  const ok = !releaseOriginRequired || releaseOrigin.status === "ready";

  return NextResponse.json(
    {
      ok,
      service: "platform",
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
