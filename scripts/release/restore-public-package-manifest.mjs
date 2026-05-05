#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const packageDir = process.cwd();
const packageJsonPath = path.join(packageDir, "package.json");
const backupPath = path.join(packageDir, ".package.json.publish-backup");

if (fs.existsSync(backupPath)) {
  fs.copyFileSync(backupPath, packageJsonPath);
  fs.rmSync(backupPath);
}
