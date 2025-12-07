import * as mdx from "@mdx-js/mdx";
import rehypeShiki from "@shikijs/rehype";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
} from "@shikijs/transformers";
import rehypeMdxCodeProps from "rehype-mdx-code-props";
import rehypeSlug from "rehype-slug";

const DEFAULT_RENDERER = `import React from 'react'`;

// custom shiki configuration matching next.config.ts
const rehypeShikiOptions = {
  themes: { light: "one-dark-pro", dark: "one-dark-pro" },
  addLanguageClass: true,
  transformers: [transformerNotationDiff(), transformerNotationHighlight()],

  // hack to pass data props through shiki
  // https://github.com/shikijs/shiki/issues/629
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

const loader = async function (content) {
  const callback = this.async();
  const isDev = this.mode === "development";

  const options = {
    development: isDev,
    providerImportSource: "@/mdx-components",
    remarkPlugins: [],
    rehypePlugins: [
      [rehypeShiki, rehypeShikiOptions],
      rehypeSlug, // add `id` to all headings
      rehypeMdxCodeProps, // provide custom props on `code` and `pre` blocks
    ],
  };

  let result;

  try {
    result = await mdx.compile(content, options);
  } catch (err) {
    return callback(err);
  }

  const { renderer = DEFAULT_RENDERER } = options;

  const code = `${renderer}\n${result}`;
  return callback(null, code);
};

export default loader;
