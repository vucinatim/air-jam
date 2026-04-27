import {
  buildLocalScaffoldPackageSet,
  packLocalScaffoldPackageSet,
} from "../lib/local-scaffold-packages.mjs";

export const runRepoPackLocalCommand = () => {
  buildLocalScaffoldPackageSet();
  const tarballs = packLocalScaffoldPackageSet();

  console.log("");
  console.log("Local tarballs ready:");
  for (const [packageName, tarballPath] of tarballs.entries()) {
    console.log(`- ${packageName}: ${tarballPath}`);
  }
};
