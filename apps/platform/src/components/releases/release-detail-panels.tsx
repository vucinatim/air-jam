"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, Package } from "lucide-react";

const formatDateTime = (value?: Date | string | null): string => {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatBytes = (value?: number | null): string => {
  if (!value || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
};

const formatCheckKind = (value: string): string =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

type ReleaseDetailPanelsProps = {
  artifact: {
    originalFilename: string;
    sizeBytes: number;
    extractedSizeBytes: number | null;
    fileCount: number | null;
    contentHash: string | null;
  } | null;
  checks: Array<{
    id: string;
    kind: string;
    status: "pending" | "passed" | "failed" | "warning";
    summary: string | null;
    createdAt: Date | string;
  }>;
  reports: Array<{
    id: string;
    reason: string;
    status: string;
    details: string | null;
    createdAt: Date | string;
    reporterEmail: string | null;
  }>;
};

export function ReleaseDetailPanels({
  artifact,
  checks,
  reports,
}: ReleaseDetailPanelsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase">
          <Package className="h-3 w-3" />
          Artifact
        </div>
        {artifact ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">File</span>
              <span className="max-w-[65%] truncate text-right">
                {artifact.originalFilename}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Uploaded</span>
              <span>{formatBytes(artifact.sizeBytes)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Extracted</span>
              <span>{formatBytes(artifact.extractedSizeBytes)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Files</span>
              <span>{artifact.fileCount?.toLocaleString() ?? "Unknown"}</span>
            </div>
            {artifact.contentHash && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Hash</span>
                <code className="max-w-[65%] truncate text-right text-[11px]">
                  {artifact.contentHash}
                </code>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No artifact metadata yet.</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase">
          <CheckCircle2 className="h-3 w-3" />
          Checks
        </div>
        {checks.length > 0 ? (
          <div className="space-y-2">
            {checks.map((check) => (
              <div key={check.id} className="rounded-md border p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{formatCheckKind(check.kind)}</span>
                  <Badge
                    variant={
                      check.status === "passed"
                        ? "default"
                        : check.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {check.status}
                  </Badge>
                </div>
                {check.summary && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {check.summary}
                  </p>
                )}
                <p className="text-muted-foreground mt-1 text-[10px]">
                  {formatDateTime(check.createdAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No checks recorded yet.</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase">
          <FileText className="h-3 w-3" />
          Reports
        </div>
        {reports.length > 0 ? (
          <div className="space-y-2">
            {reports.map((report) => (
              <div key={report.id} className="rounded-md border p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{report.reason}</span>
                  <Badge
                    variant={report.status === "open" ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {report.status}
                  </Badge>
                </div>
                {report.details && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {report.details}
                  </p>
                )}
                <p className="text-muted-foreground mt-1 text-[10px]">
                  {formatDateTime(report.createdAt)}
                  {report.reporterEmail ? ` · ${report.reporterEmail}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No reports filed.</p>
        )}
      </div>
    </div>
  );
}
