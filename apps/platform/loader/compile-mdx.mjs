import * as mdx from "@mdx-js/mdx";
import rehypeShiki from "@shikijs/rehype";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
} from "@shikijs/transformers";
import rehypeMdxCodeProps from "rehype-mdx-code-props";
import rehypeSlug from "rehype-slug";

const DEFAULT_RENDERER = `import React from 'react'`;

const rehypeShikiOptions = {
  themes: { light: "one-dark-pro", dark: "one-dark-pro" },
  addLanguageClass: true,
  transformers: [transformerNotationDiff(), transformerNotationHighlight()],
  parseMetaString: (str) => {
    return Object.fromEntries(
      str.split(" ").reduce((prev, curr) => {
        const [key, value] = curr.split("=");
        const isNormalKey = /^[A-Z0-9]+$/i.test(key);
        if (isNormalKey) {
          prev.push([key, value || true]);
        }
        return prev;
      }, []),
    );
  },
};

export async function compileMdxSource(content, { development = false } = {}) {
  const result = await mdx.compile(content, {
    development,
    providerImportSource: "@/mdx-components",
    remarkPlugins: [],
    rehypePlugins: [
      [rehypeShiki, rehypeShikiOptions],
      rehypeSlug,
      rehypeMdxCodeProps,
    ],
  });

  return `${DEFAULT_RENDERER}\n${result}`;
}
