import path from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "platform-mdx",
      enforce: "pre",
      async transform(code, id) {
        if (!id.endsWith(".mdx")) {
          return null;
        }

        const { compileMdxSource } = await import(
          pathToFileURL(path.resolve(__dirname, "loader/compile-mdx.mjs")).href
        );

        return {
          code: await compileMdxSource(code),
          map: null,
        };
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@content": path.resolve(__dirname, "../../content"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
