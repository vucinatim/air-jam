import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import React, { type HTMLAttributes, type ReactElement, type ReactNode } from "react";

export interface FigureBlockProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  "data-rehype-pretty-code-figure"?: string;
}

function isReactElement(node: ReactNode): node is ReactElement {
  return typeof node === "object" && node !== null && "props" in node;
}

/**
 * Custom figure block component for Shiki-transformed code blocks
 * Handles code blocks that have been processed by Shiki/rehype-pretty-code
 */
export default function FigureBlock({
  "data-rehype-pretty-code-figure": isShikiFigure,
  children,
  className,
  ...props
}: FigureBlockProps) {
  // Only handle Shiki-transformed code blocks
  if (!isShikiFigure) {
    return <figure className={className} {...props}>{children}</figure>;
  }

  // Find the pre element and then the code element inside it
  const preElement = React.Children.toArray(children).find(
    (child) => isReactElement(child) && child.type === "pre",
  ) as
    | ReactElement<{
        className?: string;
        children?: ReactNode;
      }>
    | undefined;

  const codeElement = preElement
    ? (React.Children.toArray(preElement.props.children).find(
        (child) => isReactElement(child) && child.type === "code",
      ) as
        | ReactElement<{
            className?: string;
            "data-language"?: string;
            filename?: string;
            "data-meta"?: string;
          }>
        | undefined)
    : undefined;

  // Extract language from code element
  const language =
    codeElement?.props?.["data-language"] ||
    codeElement?.props?.className
      ?.split(" ")
      .find((cls) => cls.startsWith("language-"))
      ?.replace("language-", "") ||
    undefined;

  // Extract file name from code element props or data-meta
  const fileName =
    codeElement?.props?.filename ||
    (() => {
      const meta = codeElement?.props?.["data-meta"] || "";
      const filenameMatch = meta.match(/filename="([^"]+)"/);
      const fileMatch = meta.match(/file="([^"]+)"/);
      return filenameMatch ? filenameMatch[1] : fileMatch ? fileMatch[1] : null;
    })();

  // Format language name for display
  const formatLanguage = (lang: string) => {
    const langMap: Record<string, string> = {
      ts: "TypeScript",
      tsx: "TSX",
      js: "JavaScript",
      jsx: "JSX",
      json: "JSON",
      css: "CSS",
      html: "HTML",
      md: "Markdown",
      py: "Python",
      rs: "Rust",
      go: "Go",
      typescript: "TypeScript",
      javascript: "JavaScript",
    };
    return (
      langMap[lang.toLowerCase()] ||
      lang.charAt(0).toUpperCase() + lang.slice(1)
    );
  };

  // Always render the same structure to avoid hydration mismatches
  // Add header as first child if needed, preserve all Shiki props exactly
  return (
    <figure
      {...props}
      data-rehype-pretty-code-figure={isShikiFigure}
      className={cn(
        "border-border/50 my-6 overflow-hidden rounded-2xl border bg-zinc-950",
        className,
      )}
    >
      {(fileName || language) && (
        <div className="border-border/50 flex items-center justify-between border-b bg-zinc-900/50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            {fileName && (
              <>
                <svg
                  className="text-muted-foreground h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="text-muted-foreground font-mono text-sm">
                  {fileName}
                </span>
              </>
            )}
          </div>
          {language && (
            <Badge variant="outline" className="text-xs">
              {formatLanguage(language)}
            </Badge>
          )}
        </div>
      )}
      {/* Preserve Shiki's children exactly as-is */}
      {children}
    </figure>
  );
}

