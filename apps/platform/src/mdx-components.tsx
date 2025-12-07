import type { MDXComponents } from "mdx/types";

import pre from "@/components/docs/pre-block";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    pre,
  };
}
