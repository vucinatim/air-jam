import fse from "fs-extra";
import path from "node:path";
import yazl from "yazl";

export const normalizedTemplateArchiveMtime = new Date(
  "2000-01-01T00:00:00.000Z",
);

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

const normalizeArchiveMode = (stats) =>
  stats.mode & 0o111 ? 0o100755 : 0o100644;

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
    const relativePath = normalizeArchivePath(path.relative(sourceDir, filePath));
    if (!relativePath) {
      continue;
    }

    const stats = await fse.stat(filePath);
    zipFile.addFile(filePath, relativePath, {
      mode: normalizeArchiveMode(stats),
      mtime: normalizedTemplateArchiveMtime,
    });
  }

  zipFile.end();
  await closePromise;
};
