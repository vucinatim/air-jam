import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

import {
  buildOsvQueries,
  normalizeOsvBatchResponse,
} from "../../release/audit-production-inventory.mjs";
import {
  loadWorkspacePackageIndex,
  preparePublicPackageManifest,
} from "../../release/public-package-manifest.mjs";
import {
  PUBLIC_PACKAGE_DEFINITIONS,
  resolvePublicPackages,
} from "../../release/public-packages.mjs";
import {
  assertPublicVersionAvailability,
  computeCandidateDigest,
  publicReleaseCandidateContract,
  resolveCandidatePublicationTag,
  validatePublicReleaseCandidate,
} from "../lib/public-release-candidate.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const integrity = (value) =>
  `sha512-${createHash("sha512").update(value).digest("base64")}`;

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

test("candidate creation rejects any public version already present on npm", () => {
  assert.doesNotThrow(() =>
    assertPublicVersionAvailability([
      { name: "@air-jam/sdk", version: "0.9.3", published: null },
    ]),
  );
  assert.throws(
    () =>
      assertPublicVersionAvailability([
        {
          name: "@air-jam/sdk",
          version: "0.9.2",
          published: { integrity: "sha512-existing" },
        },
        { name: "@air-jam/cli", version: "0.9.3", published: null },
      ]),
    /@air-jam\/sdk@0\.9\.2[\s\S]*Bump the coordinated public version/u,
  );
});

test("candidate creation checks registry availability before expensive gates", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "scripts/repo/lib/public-release-candidate.mjs"),
    "utf8",
  );
  const availabilityIndex = source.indexOf(
    'onProgress("registry:version-availability")',
  );
  const releaseGateIndex = source.indexOf('onProgress("gate:release-publish")');
  assert.ok(availabilityIndex >= 0);
  assert.ok(releaseGateIndex >= 0);
  assert.ok(availabilityIndex < releaseGateIndex);
});

const createCandidateFixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "airjam-candidate-test-"));
  const publicPackages = resolvePublicPackages();
  const dependencyPackages = publicPackages.map((entry) => ({
    name: entry.packageName,
    version: entry.version,
  }));
  const evidenceDocuments = {
    dependencies: {
      contract: "air-jam-production-dependency-inventory/v1",
      roots: publicPackages.map((entry) => entry.packageName),
      packages: dependencyPackages,
    },
    licenses: {
      contract: "air-jam-production-license-inventory/v1",
      packages: dependencyPackages.map((entry) => ({
        ...entry,
        license: "MIT",
        source: "installed-package",
      })),
      missing: [],
    },
    audit: {
      contract: "air-jam-production-dependency-audit/v1",
      method: "osv-querybatch",
      provider: "OSV.dev",
      endpoint: "https://api.osv.dev/v1/querybatch",
      inventorySha256: "pending",
      queriedPackages: dependencyPackages.length,
      queriedVersions: dependencyPackages.length,
      vulnerabilityCount: 0,
      findings: [],
    },
  };
  const evidence = {};
  for (const [name, document] of Object.entries(evidenceDocuments)) {
    const relativeFile = `evidence/${name}.json`;
    if (name === "audit") {
      document.inventorySha256 = evidence.dependencies.sha256;
    }
    writeJson(path.join(root, relativeFile), document);
    evidence[name] = {
      file: relativeFile,
      sha256: sha256(fs.readFileSync(path.join(root, relativeFile))),
    };
  }
  const workspacePackages = loadWorkspacePackageIndex(repoRoot);
  const packages = publicPackages.map((pkg) => {
    const content = Buffer.from(`${pkg.packageName}@${pkg.version}`);
    const file = `packages/${pkg.id}-${pkg.version}.tgz`;
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
    const prepared = preparePublicPackageManifest({
      manifest: JSON.parse(
        fs.readFileSync(
          path.join(repoRoot, pkg.workingDirectory, "package.json"),
        ),
      ),
      workspacePackages,
    });
    return {
      id: pkg.id,
      name: pkg.packageName,
      version: pkg.version,
      dependencies: prepared.dependencies ?? {},
      optionalDependencies: prepared.optionalDependencies ?? {},
      peerDependencies: prepared.peerDependencies ?? {},
      file,
      bytes: content.length,
      sha256: sha256(content),
      integrity: integrity(content),
    };
  });
  const manifest = {
    contract: publicReleaseCandidateContract,
    createdAt: "2026-09-04T00:00:00.000Z",
    source: {
      repository: "https://github.com/vucinatim/air-jam",
      commit: "a".repeat(40),
    },
    version: packages[0].version,
    toolchain: {
      node: "24.0.0",
      npm: "12.0.2",
      pnpm: "9.9.0",
      packageManager: "pnpm@9.9.0",
    },
    inputs: {
      packageManifestSha256: "b".repeat(64),
      lockfileSha256: "c".repeat(64),
    },
    packages,
    evidence,
  };
  manifest.candidateDigest = computeCandidateDigest(manifest);
  writeJson(path.join(root, "manifest.json"), manifest);
  return { root, manifest };
};

test("candidate validation binds every byte to one identity", () => {
  const fixture = createCandidateFixture();
  try {
    const result = validatePublicReleaseCandidate(fixture.root, {
      expectedCommit: "a".repeat(40),
    });
    assert.equal(result.candidateDigest, fixture.manifest.candidateDigest);

    fs.appendFileSync(
      path.join(fixture.root, fixture.manifest.packages[0].file),
      "tampered",
    );
    assert.throws(
      () => validatePublicReleaseCandidate(fixture.root),
      /candidate bytes do not match/u,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("candidate validation rejects unmanifested files", () => {
  const fixture = createCandidateFixture();
  try {
    fs.writeFileSync(path.join(fixture.root, "packages", "surprise.tgz"), "x");
    assert.throws(
      () => validatePublicReleaseCandidate(fixture.root),
      /Candidate packages entries differ/u,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("candidate validation rejects digest-consistent unsafe audit evidence", () => {
  const fixture = createCandidateFixture();
  try {
    const auditPath = path.join(fixture.root, "evidence", "audit.json");
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    audit.vulnerabilityCount = 1;
    audit.findings = [
      {
        id: "GHSA-test-test-test",
        modified: "2026-09-04T00:00:00.000Z",
        package: "kleur",
        version: "4.1.5",
      },
    ];
    fs.rmSync(auditPath);
    writeJson(auditPath, audit);
    fixture.manifest.evidence.audit.sha256 = sha256(fs.readFileSync(auditPath));
    fixture.manifest.candidateDigest = computeCandidateDigest(fixture.manifest);
    fs.rmSync(path.join(fixture.root, "manifest.json"));
    writeJson(path.join(fixture.root, "manifest.json"), fixture.manifest);

    assert.throws(
      () => validatePublicReleaseCandidate(fixture.root),
      /dependency audit is not releasable/u,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("public packages are ordered before packages that depend on them", () => {
  assert.deepEqual(
    PUBLIC_PACKAGE_DEFINITIONS.map((entry) => entry.id),
    ["sdk", "mcp-server", "cli", "server", "create-airjam"],
  );
});

test("npm publication uses a candidate-specific non-public channel", () => {
  assert.equal(
    resolveCandidatePublicationTag("a".repeat(64)),
    "airjam-candidate-aaaaaaaaaaaaaaaa",
  );
  assert.throws(
    () => resolveCandidatePublicationTag("not-a-digest"),
    /must be a SHA-256/u,
  );
});

test("repo CLI can inspect publication but cannot apply it", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/repo/cli.mjs", "release", "publish", "--help"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.match(output, /apply is GitHub OIDC-only/u);
  assert.doesNotMatch(output, /--apply/u);
});

test("dependency audit queries are exact, deduplicated, and normalized", () => {
  const queries = buildOsvQueries({
    contract: "air-jam-production-dependency-inventory/v1",
    packages: [
      { name: "zeta", version: "2.0.0" },
      { name: "alpha", version: "1.0.0" },
      { name: "zeta", version: "2.0.0" },
      { name: "zeta", version: "1.0.0" },
    ],
  });
  assert.deepEqual(queries, [
    { package: { ecosystem: "npm", name: "alpha" }, version: "1.0.0" },
    { package: { ecosystem: "npm", name: "zeta" }, version: "1.0.0" },
    { package: { ecosystem: "npm", name: "zeta" }, version: "2.0.0" },
  ]);

  const normalized = normalizeOsvBatchResponse({
    response: {
      results: [
        {},
        {},
        { vulns: [{ id: "GHSA-test", modified: "2026-09-04T00:00:00Z" }] },
      ],
    },
    queries,
    inventorySha256: "a".repeat(64),
  });
  assert.equal(normalized.vulnerabilityCount, 1);
  assert.equal(normalized.queriedPackages, 2);
  assert.equal(normalized.queriedVersions, 3);
  assert.equal(normalized.findings[0].package, "zeta");
});

test("all GitHub Actions dependencies use immutable commits", () => {
  const workflowDirectory = path.join(repoRoot, ".github/workflows");
  const trustedPins = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "scripts/release/github-action-pins.json"),
      "utf8",
    ),
  );
  const observedActions = new Set();
  for (const filename of fs.readdirSync(workflowDirectory)) {
    const source = fs.readFileSync(
      path.join(workflowDirectory, filename),
      "utf8",
    );
    for (const match of source.matchAll(
      /^\s*uses:\s*([^\s#]+)(?:\s+#\s*(.+))?$/gmu,
    )) {
      const reference = match[1];
      const separator = reference.lastIndexOf("@");
      assert.ok(separator > 0, `${filename}: ${reference}`);
      const action = reference.slice(0, separator);
      const sha = reference.slice(separator + 1);
      const pin = trustedPins[action];
      assert.ok(pin, `${filename}: ${action} has no trusted pin record`);
      observedActions.add(action);
      assert.equal(
        sha,
        pin.sha,
        `${filename}: ${action} must use its trusted SHA`,
      );
      assert.equal(
        match[2]?.trim(),
        pin.version,
        `${filename}: ${action} must use its trusted version comment`,
      );
    }
  }
  assert.deepEqual(observedActions, new Set(Object.keys(trustedPins)));
});

test("publish workflow validates one candidate before privileged publication", () => {
  const workflow = parseYaml(
    fs.readFileSync(
      path.join(repoRoot, ".github/workflows/publish-packages.yml"),
      "utf8",
    ),
  );
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.deepEqual(workflow.jobs.publish.needs, ["candidate", "aggregate"]);
  assert.equal(workflow.jobs.publish.permissions["id-token"], "write");
  assert.equal(workflow.jobs.publish.permissions.contents, "read");
  assert.equal(workflow.jobs.finalize.permissions.contents, "write");
  assert.equal(workflow.jobs.candidate.permissions, undefined);
  assert.equal(workflow.jobs.verify.permissions, undefined);
  assert.equal(workflow.jobs.aggregate.permissions, undefined);
  assert.equal(JSON.stringify(workflow).includes("NPM_TOKEN"), false);
  assert.equal(
    workflow.jobs.publish.steps.some(
      (entry) => entry.name === "Install repository dependencies",
    ),
    false,
  );
  assert.equal(
    workflow.jobs.publish.steps.some((entry) =>
      /pnpm\s+(?:install|build)/u.test(entry.run ?? ""),
    ),
    false,
  );
  assert.match(
    workflow.jobs.publish.steps.find(
      (entry) => entry.name === "Publish and verify exact tarballs",
    ).run,
    /publish-public-candidate\.mjs[\s\S]*--apply/u,
  );
  const finalizeRun = workflow.jobs.finalize.steps.find(
    (entry) => entry.name === "Reconcile package tags and releases",
  ).run;
  assert.doesNotMatch(finalizeRun, /done\s*<\s*<\(/u);
  assert.match(finalizeRun, /test "\$\(wc -l < "\$PACKAGES_FILE"/u);
  assert.match(finalizeRun, /done < "\$PACKAGES_FILE"/u);
});
