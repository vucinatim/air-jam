"use client";

import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CopyCodeButtonProps {
  code: string;
}

export function CopyCodeButton({ code }: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!code.trim()) {
      return;
    }

    try {
      const didCopy = await copyToClipboard(code);
      if (!didCopy) {
        setCopied(false);
        return;
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
      aria-label="Copy code"
      disabled={!code.trim()}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}
