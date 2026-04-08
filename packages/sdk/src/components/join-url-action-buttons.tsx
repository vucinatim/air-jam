import type { JSX } from "react";
import { cn } from "../utils/cn";
import { Button } from "./ui/button";

export interface JoinUrlActionButtonsProps {
  hasValue: boolean;
  copied?: boolean;
  onCopy?: () => void;
  onOpen?: () => void;
  className?: string;
  buttonClassName?: string;
}

export const JoinUrlActionButtons = ({
  hasValue,
  copied = false,
  onCopy,
  onOpen,
  className,
  buttonClassName,
}: JoinUrlActionButtonsProps): JSX.Element => {
  return (
    <div className={cn("flex gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasValue || !onCopy}
        onClick={onCopy}
        className={cn(
          "rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10",
          buttonClassName,
        )}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasValue || !onOpen}
        onClick={onOpen}
        className={cn(
          "rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10",
          buttonClassName,
        )}
      >
        Open
      </Button>
    </div>
  );
};
