import type { JSX } from "react";
import { cn } from "../utils/cn";
import { Button } from "./ui/button";
import { shellUtilityButtonClassName } from "./shell-classes";

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
    <div className={cn("grid grid-cols-2 gap-2 sm:flex sm:items-center", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasValue || !onCopy}
        onClick={onCopy}
        className={cn(
          "h-11 rounded-2xl px-4 text-sm",
          shellUtilityButtonClassName,
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
          "h-11 rounded-2xl px-4 text-sm",
          shellUtilityButtonClassName,
          buttonClassName,
        )}
      >
        Open
      </Button>
    </div>
  );
};
