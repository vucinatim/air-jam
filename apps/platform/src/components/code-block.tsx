"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import React from "react";

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  "data-rehype-pretty-code-figure"?: string;
  children?: React.ReactNode;
}

/**
 * Custom code block component with file title and language badge
 * Extracts file name from meta props and language from code element
 */
export const CodeBlock = ({ children, ...props }: CodeBlockProps) => {
  // Find the pre element and then the code element inside it
  const preElement = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && child.type === "pre",
  ) as
    | React.ReactElement<{
        filename?: string;
        "data-meta"?: string;
        "data-language"?: string;
        children?: React.ReactNode;
      }>
    | undefined;

  const codeElement = preElement
    ? (React.Children.toArray(preElement.props.children).find(
        (child) => React.isValidElement(child) && child.type === "code",
      ) as
        | React.ReactElement<{
            className?: string;
            "data-meta"?: string;
            filename?: string;
            "data-language"?: string;
          }>
        | undefined)
    : undefined;

  // Extract language from data-language attribute, className, or default to "text"
  const language =
    preElement?.props?.["data-language"] ||
    codeElement?.props?.["data-language"] ||
    codeElement?.props?.className
      ?.split(" ")
      .find((cls) => cls.startsWith("language-"))
      ?.replace("language-", "") ||
    "text";

  // Extract file name from props (rehype-mdx-code-props adds filename prop)
  // or from meta string (format: filename="path/to/file.tsx" or file="path/to/file.tsx")
  const fileName =
    preElement?.props?.filename ||
    codeElement?.props?.filename ||
    (() => {
      const meta =
        codeElement?.props?.["data-meta"] ||
        preElement?.props?.["data-meta"] ||
        "";
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

  return (
    <figure
      {...props}
      className={cn(
        "group border-border/50 relative my-6 overflow-hidden rounded-2xl border bg-zinc-950",
        props.className,
      )}
    >
      {/* Header with file title and language badge */}
      {(fileName || language !== "text") && (
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
          {language !== "text" && (
            <Badge variant="outline" className="text-xs">
              {formatLanguage(language)}
            </Badge>
          )}
        </div>
      )}

      {/* Code content */}
      {children}
    </figure>
  );
};
