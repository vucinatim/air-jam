#!/usr/bin/env node

import fse from "fs-extra";
import {
  scaffoldTemplatesRoot as outputRoot,
  scaffoldSourcesRoot,
} from "./lib/scaffold-source-manifests.mjs";
import { generateScaffoldTemplates } from "./lib/scaffold-template-generation.mjs";

const main = async () => {
  await fse.remove(scaffoldSourcesRoot);
  const generatedCount = await generateScaffoldTemplates({ outputRoot });

  console.log(
    `✓ Generated ${generatedCount} scaffold template archives in ${outputRoot}`,
  );
};

await main();
