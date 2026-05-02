import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Info } from "lucide-react";
import type { ComponentProps } from "react";

const shellVariants = cva(
  "not-prose my-8 max-w-full min-w-0 rounded-lg border border-border/90 bg-muted/15 py-4 pr-5 pl-5 border-l-4",
  {
    variants: {
      variant: {
        info: "border-l-airjam-cyan",
        warning: "border-l-amber-500 dark:border-l-amber-500",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const iconVariants = cva("size-4 shrink-0", {
  variants: {
    variant: {
      info: "text-airjam-cyan",
      warning: "text-amber-600 dark:text-amber-500",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

const icons = {
  info: Info,
  warning: AlertTriangle,
} as const;

const bodyTypography = cn(
  "text-muted-foreground space-y-3 text-sm leading-relaxed",
  "[&_a]:text-foreground [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-border/70",
  "[&_code]:bg-background/90 [&_code]:text-foreground [&_code]:rounded-md [&_code]:border [&_code]:border-border/50 [&_code]:px-1.5 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.8125rem]",
  "[&_p]:m-0 [&_p+p]:mt-3",
  "[&_ul]:mt-3 [&_ul]:mb-0 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-4 [&_ul]:marker:text-muted-foreground/50",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
);

export type CalloutProps = ComponentProps<"aside"> &
  VariantProps<typeof shellVariants> & {
    /** Short label shown above the body (e.g. “Tip”, “Note”). */
    title?: string;
  };

/**
 * Docs callout for neutral guidance (info) or things to watch for (warning).
 * Use from MDX as `<Callout variant="warning" title="…">…</Callout>` — no import needed.
 */
export const Callout = ({
  variant = "info",
  title,
  className,
  children,
  ...props
}: CalloutProps) => {
  const Icon = icons[variant ?? "info"];

  if (title) {
    return (
      <aside
        data-slot="docs-callout"
        role="note"
        className={cn(shellVariants({ variant }), className)}
        {...props}
      >
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className={iconVariants({ variant })} aria-hidden />
            <p className="text-foreground m-0 text-sm leading-tight font-semibold">
              {title}
            </p>
          </div>
          <div className={cn(bodyTypography, "min-w-0")}>{children}</div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      data-slot="docs-callout"
      role="note"
      className={cn(shellVariants({ variant }), className)}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon className={cn(iconVariants({ variant }), "mt-0.5")} aria-hidden />
        <div className={cn(bodyTypography, "min-w-0 flex-1")}>{children}</div>
      </div>
    </aside>
  );
};
