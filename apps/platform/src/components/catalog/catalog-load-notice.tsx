"use client";

import { RetryNotice } from "@/components/retry-notice";

export function CatalogLoadNotice({
  hasGames,
  isRetrying,
  onRetry,
}: {
  hasGames: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <RetryNotice
      message="We couldn’t load the game catalog."
      detail={
        hasGames ? "You can still play the games shown below." : undefined
      }
      isRetrying={isRetrying}
      onRetry={onRetry}
    />
  );
}
