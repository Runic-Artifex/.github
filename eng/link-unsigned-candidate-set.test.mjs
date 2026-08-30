import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createReceipt, runTwice, schema, verifyReceipt } from "./link-unsigned-candidate-set.mjs";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const source = { repository: "https://github.com/Runic-Artifex/runic-translations-editor", revision: "a".repeat(40), tree: "b".repeat(40) };

test("links a closed unassigned three-RID candidate set deterministically", async () => {
  await withFixture(async ({ authority, stages, root }) => {
    const receipt = await createReceipt(authority, stages);
    assert.equal(receipt.schema, schema);
    assert.equal(receipt.publication, "forbidden");
    assert.equal(receipt.platforms.length, 3);
    assert.deepEqual((await runTwice(authority, stages)).journeys, [receipt, receipt]);
    assert.deepEqual(verifyReceipt(receipt, receipt), { ok: true, errors: [] });
    const support = join(root, "support.json"), native = join(root, "native.json");
    await writeFile(support, JSON.stringify({ schema: "runic.support-envelope-consumer-repeat/1" }));
    await writeFile(native, JSON.stringify({ schema: "runic.native-shell-consumer-repeat/1" }));
    assert.deepEqual((await createReceipt(authority, stages, [`native-capability:${native}`, `support-envelope:${support}`])).productEvidence.map((item) => item.role), ["native-capability", "support-envelope"]);
  });
});

test("fails closed for authority, platform, staging, placeholder, and payload drift", async () => {
  await withFixture(async ({ authority, stages, root }) => {
    const rejects = async (name, mutate) => {
      await mutate();
      await assert.rejects(() => createReceipt(authority, stages), new RegExp(name));
    };
    await rejects("candidate set must contain", () => rm(join(stages, "osx-arm64"), { recursive: true, force: true }));
  });
  await withFixture(async ({ authority, stages }) => {
    await writeFile(join(stages, "linux-x64", "release-staging", "provenance.json"), "{}");
    await assert.rejects(() => createReceipt(authority, stages), /staging checksum mismatch/);
  });
  await withFixture(async ({ authority, stages }) => {
    const receipt = JSON.parse(await readFile(join(stages, "win-x64", "release-staging", "upstream-receipt.template.json"), "utf8"));
    receipt.builder.id = "https://publisher.invalid/real";
    await writeFile(join(stages, "win-x64", "release-staging", "upstream-receipt.template.json"), JSON.stringify(receipt));
    await rewriteChecksum(join(stages, "win-x64", "release-staging"), "upstream-receipt.template.json");
    await assert.rejects(() => createReceipt(authority, stages), /non-placeholder publication or attestation data/);
  });
  await withFixture(async ({ authority, stages }) => {
    await rm(join(stages, "osx-arm64"), { recursive: true, force: true });
    await stage(stages, "osx-arm64", { ...source, revision: "c".repeat(40) });
    await assert.rejects(() => createReceipt(authority, stages), /one source revision and tree/);
  });
  await withFixture(async ({ authority, stages }) => {
    await rm(join(stages, "linux-x64"), { recursive: true, force: true });
    await symlink(join(stages, "osx-arm64"), join(stages, "linux-x64"), "dir");
    await assert.rejects(() => createReceipt(authority, stages), /must be a regular directory/);
  });
  await withFixture(async ({ authority, stages, root }) => {
    const support = join(root, "support.json");
    await writeFile(support, JSON.stringify({ schema: "runic.support-envelope-consumer-repeat/1", payload: { secret: "no" } }));
    await assert.rejects(() => createReceipt(authority, stages, [`support-envelope:${support}`]), /may not include its payload/);
  });
  await withFixture(async ({ authority, stages, root }) => {
    const support = join(root, "support.json");
    await writeFile(support, JSON.stringify({ schema: "foreign/1" }));
    await assert.rejects(() => createReceipt(authority, stages, [`support-envelope:${support}`]), /may not include its payload/);
  });
  await withFixture(async ({ authority, stages }) => {
    const copied = JSON.parse(await readFile(authority, "utf8"));
    copied.distributions.find((item) => item.id === "translations-editor-archive").version = { state: "published", value: "1.2.3" };
    await writeFile(authority, JSON.stringify(copied));
    await assert.rejects(() => createReceipt(authority, stages), /release authority is invalid|publication-forbidden/);
  });
});

async function withFixture(action) {
  const root = await mkdtemp(join(tmpdir(), "runic-unsigned-candidate-set-"));
  try {
    const authorityRoot = join(root, "authority");
    await mkdir(authorityRoot);
    await cp(new URL("../runic.release.json", import.meta.url), join(authorityRoot, "runic.release.json"));
    await cp(new URL("../runic.release.schema.json", import.meta.url), join(authorityRoot, "runic.release.schema.json"));
    execFileSync("git", ["init", "--quiet"], { cwd: authorityRoot });
    execFileSync("git", ["add", "."], { cwd: authorityRoot });
    execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "fixture"], { cwd: authorityRoot });
    const stages = join(root, "stages");
    await mkdir(stages);
    for (const rid of ["linux-x64", "osx-arm64", "win-x64"]) await stage(stages, rid);
    await action({ root, authority: join(authorityRoot, "runic.release.json"), stages });
  } finally { await rm(root, { recursive: true, force: true }); }
}

async function stage(root, runtimeIdentifier, fixtureSource = source) {
  const platform = join(root, runtimeIdentifier), staging = join(platform, "release-staging");
  await mkdir(staging, { recursive: true });
  const version = "0.1.0-preview.candidate";
  const extension = runtimeIdentifier === "win-x64" ? "zip" : "tar.gz";
  const archiveName = `Runic.Translations.Editor-${version}-${runtimeIdentifier}.${extension}`;
  const archive = join(platform, archiveName);
  await writeFile(archive, `candidate:${runtimeIdentifier}`);
  const artifact = { path: archiveName, sha256: sha(await readFile(archive)), size: (await readFile(archive)).byteLength, mediaType: extension === "zip" ? "application/zip" : "application/gzip", identity: "Runic.Translations.Editor", product: "editor", version, type: "distribution", id: `runic-translations-editor-${runtimeIdentifier}`, kind: "self-contained-desktop-archive" };
  const release = { schema: "runic.translations.editor-release/1", channel: "preview", version, runtimeIdentifier, repositoryCommit: fixtureSource.revision, repositoryTree: fixtureSource.tree, artifacts: [artifact] };
  const packageManifest = { schema: "runic.translations.editor-package/1", version, updateChannel: "preview", repositoryCommit: fixtureSource.revision, repositoryTree: fixtureSource.tree, runtimeIdentifier, selfContained: true, files: [] };
  const provenance = { schema: "runic.translations.editor-provenance/1", source: fixtureSource, artifact };
  const receipt = { schemaVersion: 1, artifact, attestationBundle: { path: "REPLACE_WITH_GITHUB_ATTESTATION_BUNDLE", sha256: "REPLACE_WITH_64_LOWERCASE_HEX" }, source: fixtureSource, builder: { id: "REPLACE_WITH_GITHUB_BUILDER_ID" }, invocation: { id: "REPLACE_WITH_GITHUB_INVOCATION_ID" }, materials: [{ uri: "REPLACE_WITH_MATERIAL_URI", sha256: "REPLACE_WITH_64_LOWERCASE_HEX" }] };
  const files = {
    "dependencies.json": { schema: "runic.translations.editor-dependencies/1", packages: [], notices: [] },
    "package-manifest.json": packageManifest,
    "provenance.json": provenance,
    "release-manifest.json": release,
    "sbom.spdx.json": { spdxVersion: "SPDX-2.3", packages: [], relationships: [] },
    "upstream-receipt.template.json": receipt,
  };
  for (const [name, value] of Object.entries(files)) await writeFile(join(staging, name), JSON.stringify(value));
  const sums = [[artifact.sha256, archiveName], ...await Promise.all(Object.keys(files).map(async (name) => [sha(await readFile(join(staging, name))), name]))];
  await writeFile(join(staging, "SHA256SUMS"), sums.sort((left, right) => left[1].localeCompare(right[1])).map(([hash, name]) => `${hash}  ${name}`).join("\n") + "\n");
  await writeFile(`${archive}.sha256`, `${artifact.sha256}  ${archiveName}\n`);
}

async function rewriteChecksum(staging, name) {
  const sumsPath = join(staging, "SHA256SUMS");
  const lines = (await readFile(sumsPath, "utf8")).trim().split("\n");
  const value = sha(await readFile(join(staging, name)));
  await writeFile(sumsPath, `${lines.map((line) => line.endsWith(`  ${name}`) ? `${value}  ${name}` : line).join("\n")}\n`);
}
