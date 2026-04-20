import { useCallback, useRef, useState } from "react";

export const useClipboardCopy = () => {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const resetTimeoutRef = useRef<number | null>(null);

  const markCopied = useCallback((value: string) => {
    setCopiedValue(value);

    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
    }

    resetTimeoutRef.current = window.setTimeout(() => {
      setCopiedValue(null);
      resetTimeoutRef.current = null;
    }, 900);
  }, []);

  const copyValue = useCallback(
    async (value: string): Promise<void> => {
      try {
        await navigator.clipboard.writeText(value);
        markCopied(value);
      } catch {
        const fallbackField = document.createElement("textarea");
        fallbackField.value = value;
        fallbackField.style.position = "fixed";
        fallbackField.style.opacity = "0";
        document.body.appendChild(fallbackField);
        fallbackField.select();

        try {
          document.execCommand("copy");
          markCopied(value);
        } catch {
          // Ignore copy failure.
        } finally {
          document.body.removeChild(fallbackField);
        }
      }
    },
    [markCopied],
  );

  return {
    copiedValue,
    copyValue,
  };
};
