import {
  buildLocalScaffoldPackageSet,
  packLocalScaffoldPackageSet,
} from "../lib/local-scaffold-packages.mjs";

export const runRepoPackLocalCommand = () => {
  buildLocalScaffoldPackageSet();
  const { manifestPath, setDir, setId, tarballs } =
    packLocalScaffoldPackageSet();

  console.log("");
  console.log(`Local tarballs ready in immutable set ${setId}:`);
  console.log(`- set dir: ${setDir}`);
  console.log(`- manifest: ${manifestPath}`);
  for (const [packageName, tarballPath] of tarballs.entries()) {
    console.log(`- ${packageName}: ${tarballPath}`);
  }
};
