import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

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
      "react/jsx-runtime": require.resolve("react/jsx-runtime"),
      "react/jsx-dev-runtime": require.resolve("react/jsx-dev-runtime"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
