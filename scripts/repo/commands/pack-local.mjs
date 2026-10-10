import {
  buildLocalScaffoldPackageSet,
  packLocalScaffoldPackageSet,
} from "../lib/local-scaffold-packages.mjs";

export const runRepoPackLocalCommand = ({ quiet = false } = {}) => {
  const stdio = quiet ? ["ignore", 2, 2] : "inherit";
  buildLocalScaffoldPackageSet({ stdio });
  const { manifestPath, setDir, setId, tarballs } = packLocalScaffoldPackageSet(
    { stdio },
  );

  if (quiet) return { manifestPath, setDir, setId };

  console.log("");
  console.log(`Local tarballs ready in immutable set ${setId}:`);
  console.log(`- set dir: ${setDir}`);
  console.log(`- manifest: ${manifestPath}`);
  for (const [packageName, tarballPath] of tarballs.entries()) {
    console.log(`- ${packageName}: ${tarballPath}`);
  }
  return { manifestPath, setDir, setId };
};
