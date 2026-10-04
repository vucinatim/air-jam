import type { PublicReleaseReportInput } from "@/lib/releases/release-report-policy";
import { useRef, useState } from "react";

const emptyDraft = { reason: "", details: "", reporterEmail: "" };

export const getReleaseReportFailureMessage = (error: unknown): string => {
  const data =
    error && typeof error === "object" && "data" in error ? error.data : null;
  if (data && typeof data === "object" && "code" in data) {
    if (data.code === "TOO_MANY_REQUESTS") {
      const seconds =
        "retryAfterSeconds" in data ? data.retryAfterSeconds : null;
      const retry =
        typeof seconds === "number" &&
        Number.isSafeInteger(seconds) &&
        seconds > 0
          ? `Please retry in ${seconds} seconds.`
          : "Please try again shortly.";
      return `Report intake is busy. Your draft is preserved. ${retry}`;
    }
    if (data.code === "NOT_FOUND") {
      return "This release is no longer public, so it cannot receive a new report. Your draft is preserved.";
    }
    if (data.code === "BAD_REQUEST") {
      return "Check your report reason and optional email address, then try again. Your draft is preserved.";
    }
    if (data.code === "CONFLICT") {
      return "This submission could not be reused. Edit your report and submit it again. Your draft is preserved.";
    }
  }
  return "We could not confirm your report was received. Your draft is preserved; check your connection and try again.";
};

/** One unchanged draft keeps its submission identity through ambiguous failures. */
export const useReleaseReportDraft = () => {
  const [draft, setDraft] = useState(emptyDraft);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<{ releaseId: string; submissionId: string } | null>(
    null,
  );

  const change = (field: keyof typeof emptyDraft, value: string) => {
    if (inFlight.current || draft[field] === value) return;
    attempt.current = null;
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const begin = (releaseId: string): PublicReleaseReportInput | null => {
    if (inFlight.current) return null;
    if (attempt.current?.releaseId !== releaseId) {
      attempt.current = { releaseId, submissionId: crypto.randomUUID() };
    }
    inFlight.current = true;
    setPending(true);
    return {
      ...attempt.current,
      source: "play_page",
      reason: draft.reason,
      details: draft.details || undefined,
      reporterEmail: draft.reporterEmail || undefined,
    };
  };

  const finish = (received: boolean) => {
    if (received) {
      setDraft(emptyDraft);
      attempt.current = null;
    }
    inFlight.current = false;
    setPending(false);
  };

  return { draft, pending, change, begin, finish };
};
