"use client";

import { platformControllerSessionConfig } from "@/lib/airjam-session-config";
import {
  getControllerLocalProfileClientSnapshot,
  getControllerLocalProfileServerSnapshot,
  subscribeControllerLocalProfile,
} from "@/lib/controller-local-profile";
import { AirJamControllerRuntime, PlatformSettingsRuntime } from "@air-jam/sdk";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useSyncExternalStore } from "react";
import { ControllerPageContent } from "./controller-page-content";
import type { ControllerPageSurfaceMode } from "./controller-page-layout";

function ControllerPageInner({
  routeRoomId,
  routeControllerCapabilityToken,
  surfaceMode,
}: {
  routeRoomId: string | null;
  routeControllerCapabilityToken: string | null;
  surfaceMode: ControllerPageSurfaceMode;
}) {
  const localProfile = useSyncExternalStore(
    subscribeControllerLocalProfile,
    getControllerLocalProfileClientSnapshot,
    getControllerLocalProfileServerSnapshot,
  );

  return (
    <PlatformSettingsRuntime persistence="local">
      <AirJamControllerRuntime
        {...platformControllerSessionConfig}
        roomId={routeRoomId ?? undefined}
        capabilityToken={routeControllerCapabilityToken}
        nickname={localProfile.label}
        avatarId={localProfile.avatarId}
      >
        <ControllerPageContent
          routeRoomId={routeRoomId}
          hasControllerCapability={Boolean(routeControllerCapabilityToken)}
          surfaceMode={surfaceMode}
        />
      </AirJamControllerRuntime>
    </PlatformSettingsRuntime>
  );
}

function ControllerRoomKeyedInner() {
  const searchParams = useSearchParams();
  const roomKey = searchParams.get("room");
  const controllerCapabilityToken = searchParams.get("aj_controller_cap");
  const routeRoomId = useMemo(() => {
    if (!roomKey) {
      return null;
    }

    const normalized = roomKey
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return normalized || null;
  }, [roomKey]);

  const surfaceMode: ControllerPageSurfaceMode = useMemo(() => {
    const preview = searchParams.get("aj_preview");
    return preview === "1" || preview === "true" ? "preview" : "default";
  }, [searchParams]);

  return (
    <ControllerPageInner
      key={`${surfaceMode}:${routeRoomId ?? ""}:${controllerCapabilityToken ?? ""}`}
      routeRoomId={routeRoomId}
      routeControllerCapabilityToken={controllerCapabilityToken}
      surfaceMode={surfaceMode}
    />
  );
}

export default function ControllerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-black text-white">
          Loading…
        </div>
      }
    >
      <ControllerRoomKeyedInner />
    </Suspense>
  );
}
