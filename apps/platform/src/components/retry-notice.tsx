"use client";

import { Button } from "@/components/ui/button";

export function RetryNotice({
  message,
  detail,
  isRetrying = false,
  disabled = false,
  onRetry,
}: {
  message: string;
  detail?: string;
  isRetrying?: boolean;
  disabled?: boolean;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="mb-6 text-center text-slate-300">
      <p>{message}</p>
      {detail ? <p className="mt-1 text-sm text-slate-400">{detail}</p> : null}
      <Button
        type="button"
        variant="outline"
        className="mt-3"
        disabled={disabled || isRetrying}
        onClick={onRetry}
      >
        {isRetrying ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}
