import { compileMdxSource } from "./compile-mdx.mjs";

const loader = async function (content) {
  const callback = this.async();
  const isDev = this.mode === "development";

  try {
    const code = await compileMdxSource(content, {
      development: isDev,
    });
    return callback(null, code);
  } catch (err) {
    return callback(err);
  }
};

export default loader;
