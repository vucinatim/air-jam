/** Source identity also defines the files preserved by Studio recovery. */
export const SOURCE_EXCLUDES = [
  "node_modules/",
  ".airjam/logs/",
  ".airjam/devtools/",
  ".airjam/artifacts/",
  ".airjam/releases/",
  ".airjam/auth/",
  ".airjam/preview-managed-server.json",
  ".airjam/release-manifest.json",
  "/dist",
  "/build",
];

// Portable so a fresh container can fingerprint before installing game packages.
export const SOURCE_TREE_PROGRAM = `
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const excluded = ${JSON.stringify(SOURCE_EXCLUDES)}.map(value => value.replace(/^\\/|\\/$/g, ''));
const hash = createHash('sha256');
const entries = [];
function walk(directory, relative = '') {
  for (const name of fs.readdirSync(directory).sort()) {
    const filename = relative ? relative + '/' + name : name;
    if (excluded.some(value => filename === value || filename.startsWith(value + '/') || (value === 'node_modules' && name === value))) continue;
    const absolute = path.join(directory, name);
    const stat = fs.lstatSync(absolute);
    const mode = stat.mode & 511;
    if (stat.isDirectory()) {
      hash.update(JSON.stringify([filename, mode, 'directory']));
      entries.push({ path: filename, mode, kind: 'directory' });
      walk(absolute, filename);
      continue;
    }
    const kind = stat.isSymbolicLink() ? 'link' : 'file';
    hash.update(JSON.stringify([filename, mode, kind]));
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(absolute);
      hash.update(target);
      entries.push({ path: filename, mode, kind, target });
    } else if (stat.isFile()) {
      const digest = createHash('sha256').update(fs.readFileSync(absolute)).digest();
      hash.update(digest);
      entries.push({ path: filename, mode, kind, size: stat.size, sha256: digest.toString('hex') });
    } else throw new Error('Unsupported source entry: ' + filename);
  }
}
walk(process.argv[1]);
const result = { hash: hash.digest('hex'), entries };
process.stdout.write(process.argv[2] === 'manifest' ? JSON.stringify(result) : result.hash);
`;
