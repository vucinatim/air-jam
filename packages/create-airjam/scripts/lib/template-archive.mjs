import fse from "fs-extra";
import path from "node:path";
import yazl from "yazl";

const createNormalizedTemplateArchiveMtime = () =>
  new Date(2000, 0, 1, 0, 0, 0, 0);

const normalizeArchivePath = (value) => value.replace(/\\/g, "/");

const collectFiles = async (sourceDir) => {
  const entries = await fse.readdir(sourceDir);
  const files = [];

  for (const entry of entries.sort()) {
    const absolutePath = path.join(sourceDir, entry);
    const stats = await fse.stat(absolutePath);
    if (stats.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
      continue;
    }
    files.push(absolutePath);
  }

  return files;
};

const NORMALIZED_TEMPLATE_FILE_MODE = 0o100644;

export const writeTemplateArchive = async ({ sourceDir, outputFile }) => {
  const files = await collectFiles(sourceDir);
  const zipFile = new yazl.ZipFile();

  await fse.ensureDir(path.dirname(outputFile));

  const output = fse.createWriteStream(outputFile);
  const closePromise = new Promise((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    zipFile.outputStream.on("error", reject);
  });

  zipFile.outputStream.pipe(output);

  for (const filePath of files) {
    const relativePath = normalizeArchivePath(
      path.relative(sourceDir, filePath),
    );
    if (!relativePath) {
      continue;
    }

    zipFile.addFile(filePath, relativePath, {
      compress: false,
      forceDosTimestamp: true,
      mode: NORMALIZED_TEMPLATE_FILE_MODE,
      mtime: createNormalizedTemplateArchiveMtime(),
    });
  }

  zipFile.end();
  await closePromise;
};
