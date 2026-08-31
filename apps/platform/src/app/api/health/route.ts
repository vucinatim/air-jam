import { readPlatformDeploymentIdentity } from "@/lib/platform-service-contract";
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "platform",
    deployment: readPlatformDeploymentIdentity(),
  });
}
