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

/** Source evidence archives carry the full source tree manifest under this name. */
export const SOURCE_ARCHIVE_MANIFEST = ".airjam-source.json";

/**
 * Large static assets (models, audio, video, images, fonts) are recorded in
 * source evidence by size and digest only, so asset-heavy games fit the
 * evidence limit; the manifest keeps every omitted asset pinned.
 */
export const isDigestOnlySourceFile = (entry: { path: string; size: number }) =>
  entry.size >= 256 * 1024 &&
  /\.(glb|gltf|bin|fbx|obj|png|jpe?g|webp|gif|avif|ktx2|basis|hdr|exr|mp3|ogg|wav|m4a|aac|flac|mp4|webm|woff2?|ttf|otf)$/i.test(
    entry.path,
  );

// Portable so a fresh container can fingerprint before installing game packages.
// With "fold" it reads a manifest's entries from stdin and prints their hash,
// so an archive that omits assets can still be checked against its source hash.
export const SOURCE_TREE_PROGRAM = `
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const excluded = ${JSON.stringify(SOURCE_EXCLUDES)}.map(value => value.replace(/^\\/|\\/$/g, ''));
function walk(directory, entries, relative = '') {
  for (const name of fs.readdirSync(directory).sort()) {
    const filename = relative ? relative + '/' + name : name;
    if (excluded.some(value => filename === value || filename.startsWith(value + '/') || (value === 'node_modules' && name === value))) continue;
    const absolute = path.join(directory, name);
    const stat = fs.lstatSync(absolute);
    const mode = stat.mode & 511;
    if (stat.isDirectory()) {
      entries.push({ path: filename, mode, kind: 'directory' });
      walk(absolute, entries, filename);
    } else if (stat.isSymbolicLink())
      entries.push({ path: filename, mode, kind: 'link', target: fs.readlinkSync(absolute) });
    else if (stat.isFile())
      entries.push({ path: filename, mode, kind: 'file', size: stat.size, sha256: createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') });
    else throw new Error('Unsupported source entry: ' + filename);
  }
  return entries;
}
function fold(entries) {
  const hash = createHash('sha256');
  for (const entry of entries) {
    hash.update(JSON.stringify([entry.path, entry.mode, entry.kind]));
    if (entry.kind === 'link') hash.update(entry.target);
    else if (entry.kind === 'file') hash.update(Buffer.from(entry.sha256, 'hex'));
  }
  return hash.digest('hex');
}
if (process.argv[2] === 'fold') process.stdout.write(fold(JSON.parse(fs.readFileSync(0, 'utf8')).entries));
else {
  const entries = walk(process.argv[1], []);
  const result = { hash: fold(entries), entries };
  process.stdout.write(process.argv[2] === 'manifest' ? JSON.stringify(result) : result.hash);
}
`;
