#!/usr/bin/env node

import { Command } from "commander";
import { registerCheckCommands } from "./commands/check.mjs";
import { registerGoldenPathCommands } from "./commands/golden-path.mjs";
import { registerLegacyCommands } from "./commands/legacy.mjs";
import { registerPackCommands } from "./commands/pack.mjs";
import { registerPerfCommands } from "./commands/perf.mjs";
import { registerReleaseCommands } from "./commands/release.mjs";
import { registerScaffoldCommands } from "./commands/scaffold.mjs";
import { registerStandardsCommands } from "./commands/standards.mjs";
import { registerVisualCommands } from "./commands/visual.mjs";
import { registerWorkspaceCommands } from "./commands/workspace.mjs";

const program = new Command();

program.name("air-jam-repo").description("Repo-local Air Jam maintainer CLI");

registerWorkspaceCommands(program);
registerCheckCommands(program);
registerGoldenPathCommands(program);
registerReleaseCommands(program);
registerLegacyCommands(program);
registerPerfCommands(program);
registerPackCommands(program);
registerScaffoldCommands(program);
registerStandardsCommands(program);
registerVisualCommands(program);

await program.parseAsync(process.argv.filter((value) => value !== "--"));
