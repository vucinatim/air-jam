"use client";

import { Badge } from "@/components/ui/badge";
import type { GameReleaseStatus } from "@/lib/releases/release-contract";

const releaseStatusLabelByValue: Record<GameReleaseStatus, string> = {
  draft: "Draft",
  uploading: "Uploading",
  checking: "Checking",
  ready: "Ready",
  live: "Live",
  failed: "Failed",
  quarantined: "Quarantined",
  archived: "Archived",
};

export const getReleaseStatusLabel = (status: GameReleaseStatus): string =>
  releaseStatusLabelByValue[status];

const getReleaseStatusBadgeVariant = (
  status: GameReleaseStatus,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "live":
      return "default";
    case "ready":
    case "checking":
    case "uploading":
      return "secondary";
    case "failed":
    case "quarantined":
      return "destructive";
    case "draft":
    case "archived":
    default:
      return "outline";
  }
};

const getReleaseStatusClassName = (status: GameReleaseStatus): string => {
  switch (status) {
    case "live":
      return "bg-airjam-cyan text-black";
    case "ready":
      return "bg-emerald-500 text-white";
    case "checking":
    case "uploading":
      return "bg-amber-500 text-black";
    default:
      return "";
  }
};

export function ReleaseStatusBadge({ status }: { status: GameReleaseStatus }) {
  return (
    <Badge
      variant={getReleaseStatusBadgeVariant(status)}
      className={getReleaseStatusClassName(status)}
    >
      {getReleaseStatusLabel(status)}
    </Badge>
  );
}
