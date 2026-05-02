import type { MDXComponents } from "mdx/types";

import { Callout } from "@/components/docs/callout";
import pre from "@/components/docs/pre-block";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    pre,
    Callout,
  };
}
