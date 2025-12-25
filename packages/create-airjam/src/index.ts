import { program } from "commander";
import fs from "fs-extra";
import kleur from "kleur";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prompts from "prompts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  program
    .name("create-airjam")
    .description("Scaffold a new Air Jam game project")
    .argument("[project-name]", "Name of the project directory")
    .option("-t, --template <template>", "Template to use", "pong")
    .parse();

  const args = program.args;
  const options = program.opts<{ template: string }>();

  let projectName = args[0];

  if (!projectName) {
    const response = await prompts({
      type: "text",
      name: "projectName",
      message: "Project name:",
      initial: "my-airjam-game",
    });
    projectName = response.projectName;
    if (!projectName) {
      console.log(kleur.red("Project name is required"));
      process.exit(1);
    }
  }

  const targetDir = path.resolve(process.cwd(), projectName);
  const templateDir = path.resolve(__dirname, "..", "templates", options.template);

  if (!fs.existsSync(templateDir)) {
    console.log(kleur.red(`Template "${options.template}" not found`));
    process.exit(1);
  }

  if (fs.existsSync(targetDir)) {
    const response = await prompts({
      type: "confirm",
      name: "overwrite",
      message: `Directory "${projectName}" already exists. Overwrite?`,
      initial: false,
    });
    if (!response.overwrite) {
      console.log(kleur.yellow("Aborted"));
      process.exit(0);
    }
    await fs.remove(targetDir);
  }

  console.log(kleur.cyan(`\nCreating project in ${targetDir}...\n`));

  // Copy template
  await fs.copy(templateDir, targetDir);

  // Update package.json name
  const pkgPath = path.join(targetDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    pkg.name = projectName;
    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  }

  console.log(kleur.green("✓ Project created successfully!\n"));
  console.log("Next steps:\n");
  console.log(kleur.cyan(`  cd ${projectName}`));
  console.log(kleur.cyan("  npm install"));
  console.log(kleur.cyan("  npm run dev"));
  console.log("");
  console.log(
    kleur.dim("Then open http://localhost:5173 and scan the QR code with your phone!")
  );
}

main().catch((err) => {
  console.error(kleur.red("Error:"), err);
  process.exit(1);
});
