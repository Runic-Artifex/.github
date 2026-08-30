#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { verify } from "./verify-release-manifest.mjs";

export const schema = "runic.unsigned-candidate-set/1";
export const repeatSchema = "runic.unsigned-candidate-set-repeat/1";
const rids = ["linux-x64", "osx-arm64", "win-x64"];
const stagingFiles = ["SHA256SUMS", "dependencies.json", "package-manifest.json", "provenance.json", "release-manifest.json", "sbom.spdx.json", "upstream-receipt.template.json"];
const placeholders = {
  attestationBundle: { path: "REPLACE_WITH_GITHUB_ATTESTATION_BUNDLE", sha256: "REPLACE_WITH_64_LOWERCASE_HEX" },
  builder: { id: "REPLACE_WITH_GITHUB_BUILDER_ID" },
  invocation: { id: "REPLACE_WITH_GITHUB_INVOCATION_ID" },
  materials: [{ uri: "REPLACE_WITH_MATERIAL_URI", sha256: "REPLACE_WITH_64_LOWERCASE_HEX" }],
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const sha256 = async (path) => digest(await readFile(path));
const fail = (message) => { throw new Error(`unsigned candidate set: ${message}`); };

function command(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${command} ${args.join(" ")} failed: ${stderr || error.message}`));
      else resolvePromise(stdout.trim());
    });
  });
}

async function regular(path, description) {
  const entry = await lstat(path);
  if (!entry.isFile() || entry.isSymbolicLink()) fail(`${description} must be a regular file`);
  return entry;
}

async function directory(path, description) {
  const entry = await lstat(path);
  if (!entry.isDirectory() || entry.isSymbolicLink()) fail(`${description} must be a regular directory`);
}

async function json(path, description) {
  await regular(path, description);
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { fail(`${description} must be valid JSON`); }
}

function exactObject(actual, expected, description) {
  if (!same(actual, expected)) fail(description);
}

async function authority(manifestPath) {
  const path = resolve(manifestPath);
  const root = dirname(path);
  const text = await readFile(path, "utf8");
  const manifest = JSON.parse(text);
  const schemaPath = join(root, "runic.release.schema.json");
  const errors = verify(manifest, JSON.parse(await readFile(schemaPath, "utf8")));
  if (errors.length) fail(`release authority is invalid: ${errors.join("; ")}`);
  const distributions = manifest.distributions?.filter((item) => item?.id === "translations-editor-archive");
  if (!Array.isArray(distributions) || distributions.length !== 1) fail("release authority must declare exactly one editor archive distribution");
  const distribution = distributions[0];
  if (distribution.product !== "editor" || distribution.kind !== "application-archive" || distribution.identity !== "Runic.Translations.Editor" ||
    !same(distribution.version, { state: "unassigned", value: null })) {
    fail("editor archive distribution must remain unassigned and publication-forbidden");
  }
  if ((await command("git", ["status", "--porcelain"], root)) !== "") fail("release authority worktree must be clean");
  const [revision, tree] = await Promise.all([
    command("git", ["rev-parse", "HEAD"], root),
    command("git", ["rev-parse", "HEAD^{tree}"], root),
  ]);
  return { path: basename(path), revision, tree, sha256: digest(text), distribution };
}

function parseChecksums(text, expectedNames) {
  const entries = text.trim().split("\n").filter(Boolean);
  const values = new Map();
  for (const line of entries) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._+\-]*)$/.exec(line);
    if (!match || values.has(match?.[2])) fail("staging checksum set is malformed");
    values.set(match[2], match[1]);
  }
  if (!same([...values.keys()].sort(), [...expectedNames].sort())) fail("staging checksum set is not closed");
  return values;
}

async function platform(root, rid) {
  const platformRoot = join(root, rid);
  await directory(platformRoot, `${rid} platform root`);
  const entries = await readdir(platformRoot, { withFileTypes: true });
  const names = entries.map((item) => item.name).sort();
  const extension = rid === "win-x64" ? "zip" : "tar.gz";
  const archiveName = names.find((name) => new RegExp(`^Runic\\.Translations\\.Editor-[0-9][0-9A-Za-z.\\-+]*-${rid.replace("-", "\\-")}\\.${extension.replace(".", "\\.")}$`).test(name));
  if (archiveName === undefined || !same(names, [archiveName, `${archiveName}.sha256`, "release-staging"].sort())) fail(`${rid} platform root is not closed`);
  const archivePath = join(platformRoot, archiveName);
  const checksumPath = `${archivePath}.sha256`;
  await regular(archivePath, `${rid} archive`);
  await regular(checksumPath, `${rid} archive checksum`);
  const archiveBytes = await readFile(archivePath);
  const archiveDigest = digest(archiveBytes);
  if ((await readFile(checksumPath, "utf8")).trim() !== `${archiveDigest}  ${archiveName}`) fail(`${rid} archive checksum mismatch`);

  const stagingRoot = join(platformRoot, "release-staging");
  await directory(stagingRoot, `${rid} release staging`);
  const stagingEntries = await readdir(stagingRoot, { withFileTypes: true });
  if (!same(stagingEntries.map((item) => item.name).sort(), [...stagingFiles].sort()) || stagingEntries.some((item) => !item.isFile() || item.isSymbolicLink())) fail(`${rid} release staging is not a closed regular-file set`);
  const checksumText = await readFile(join(stagingRoot, "SHA256SUMS"), "utf8");
  const checksums = parseChecksums(checksumText, [...stagingFiles.filter((name) => name !== "SHA256SUMS"), archiveName]);
  for (const name of stagingFiles.filter((name) => name !== "SHA256SUMS")) {
    if (checksums.get(name) !== await sha256(join(stagingRoot, name))) fail(`${rid} staging checksum mismatch for ${name}`);
  }
  if (checksums.get(archiveName) !== archiveDigest) fail(`${rid} staging checksum mismatch for archive`);

  const [release, packageManifest, sbom, provenance, receiptTemplate] = await Promise.all([
    json(join(stagingRoot, "release-manifest.json"), `${rid} release manifest`),
    json(join(stagingRoot, "package-manifest.json"), `${rid} package manifest`),
    json(join(stagingRoot, "sbom.spdx.json"), `${rid} SBOM`),
    json(join(stagingRoot, "provenance.json"), `${rid} provenance`),
    json(join(stagingRoot, "upstream-receipt.template.json"), `${rid} receipt template`),
  ]);
  const artifact = release?.artifacts?.[0];
  if (release?.schema !== "runic.translations.editor-release/1" || release?.runtimeIdentifier !== rid || release?.artifacts?.length !== 1 ||
    !artifact || artifact.path !== archiveName || artifact.sha256 !== archiveDigest || artifact.size !== archiveBytes.byteLength ||
    artifact.identity !== "Runic.Translations.Editor" || artifact.product !== "editor" || artifact.type !== "distribution") fail(`${rid} release manifest does not bind its archive`);
  if (packageManifest?.schema !== "runic.translations.editor-package/1" || packageManifest.runtimeIdentifier !== rid || packageManifest.version !== release.version ||
    packageManifest.updateChannel !== release.channel || packageManifest.repositoryCommit !== release.repositoryCommit || packageManifest.repositoryTree !== release.repositoryTree || packageManifest.selfContained !== true) fail(`${rid} package manifest drift`);
  if (sbom?.spdxVersion !== "SPDX-2.3" || !Array.isArray(sbom?.packages) || !Array.isArray(sbom?.relationships)) fail(`${rid} SBOM is incomplete`);
  if (provenance?.schema !== "runic.translations.editor-provenance/1" || !same(provenance?.source, { repository: "https://github.com/Runic-Artifex/runic-translations-editor", revision: release.repositoryCommit, tree: release.repositoryTree }) || !same(provenance?.artifact, artifact)) fail(`${rid} provenance drift`);
  if (receiptTemplate?.schemaVersion !== 1 || !same(receiptTemplate?.artifact, artifact) || receiptTemplate?.source?.repository !== provenance.source.repository ||
    receiptTemplate?.source?.revision !== release.repositoryCommit || receiptTemplate?.source?.tree !== release.repositoryTree ||
    !same(receiptTemplate?.attestationBundle, placeholders.attestationBundle) || !same(receiptTemplate?.builder, placeholders.builder) ||
    !same(receiptTemplate?.invocation, placeholders.invocation) || !same(receiptTemplate?.materials, placeholders.materials)) fail(`${rid} receipt template contains non-placeholder publication or attestation data`);
  if (!/^[a-f0-9]{40}$/.test(release.repositoryCommit) || !/^[a-f0-9]{40}$/.test(release.repositoryTree)) fail(`${rid} staging must bind an exact source revision and tree`);
  return {
    runtimeIdentifier: rid,
    archive: { path: archiveName, sha256: archiveDigest, size: archiveBytes.byteLength },
    staging: {
      sha256sums: { sha256: digest(checksumText), entries: Object.fromEntries(checksums) },
      files: Object.fromEntries(await Promise.all(stagingFiles.filter((name) => name !== "SHA256SUMS").map(async (name) => [name, await sha256(join(stagingRoot, name))]))),
    },
    source: { repository: provenance.source.repository, revision: release.repositoryCommit, tree: release.repositoryTree },
  };
}

async function citations(values) {
  const accepted = new Map([
    ["support-envelope", "runic.support-envelope-consumer-repeat/1"],
    ["native-capability", "runic.native-shell-consumer-repeat/1"],
  ]);
  const result = [];
  for (const value of values) {
    const separator = value.indexOf(":");
    const role = value.slice(0, separator), path = value.slice(separator + 1);
    if (separator <= 0 || !accepted.has(role) || !path) fail("product evidence citation is malformed");
    const citationPath = resolve(path);
    await regular(citationPath, "product evidence citation");
    const content = await readFile(citationPath);
    let receipt;
    try { receipt = JSON.parse(content); } catch { fail("product evidence citation must be JSON"); }
    if (receipt?.schema !== accepted.get(role) || Object.prototype.hasOwnProperty.call(receipt, "payload") || Object.prototype.hasOwnProperty.call(receipt, "supportEnvelope")) fail("distribution inputs may cite product evidence but may not include its payload");
    result.push({ role, schema: receipt.schema, sha256: digest(content) });
  }
  if (new Set(result.map((item) => item.role)).size !== result.length) fail("product evidence citations must have unique roles");
  return result.sort((left, right) => left.role.localeCompare(right.role));
}

export async function createReceipt(manifestPath, stagingRoot, citationValues = []) {
  const [releaseAuthority, productEvidence] = await Promise.all([authority(manifestPath), citations(citationValues)]);
  const root = resolve(stagingRoot);
  await directory(root, "candidate set root");
  const names = (await readdir(root, { withFileTypes: true })).map((item) => item.name).sort();
  if (!same(names, [...rids].sort())) fail("candidate set must contain exactly linux-x64, osx-arm64, and win-x64");
  const platforms = await Promise.all(rids.map((rid) => platform(root, rid)));
  const source = platforms[0].source;
  if (platforms.some((item) => !same(item.source, source))) fail("candidate platforms must bind one source revision and tree");
  return { schema, publication: "forbidden", releaseAuthority, source, platforms, productEvidence };
}

export function verifyReceipt(receipt, expected) {
  const errors = [];
  if (receipt?.schema !== schema || receipt?.publication !== "forbidden") errors.push("candidate receipt must be explicitly publication-forbidden");
  if (!same(receipt, expected)) errors.push("candidate receipt does not exactly re-link current local inputs");
  return { ok: errors.length === 0, errors };
}

export async function runTwice(manifestPath, stagingRoot, citationValues = []) {
  const receipt = { schema: repeatSchema, journeys: [await createReceipt(manifestPath, stagingRoot, citationValues), await createReceipt(manifestPath, stagingRoot, citationValues)] };
  if (!same(receipt.journeys[0], receipt.journeys[1])) fail("candidate-set journeys are not deterministic");
  return receipt;
}

async function main() {
  const [commandName, manifestPath, stagingRoot, receiptPath, ...citationValues] = process.argv.slice(2);
  if (commandName === "run-twice" && manifestPath && stagingRoot && !receiptPath) process.stdout.write(`${JSON.stringify(await runTwice(manifestPath, stagingRoot, citationValues), null, 2)}\n`);
  else if (commandName === "verify-twice" && manifestPath && stagingRoot && receiptPath) {
    const expected = await runTwice(manifestPath, stagingRoot, citationValues);
    const actual = JSON.parse(await readFile(receiptPath, "utf8"));
    if (!same(actual, expected)) fail("candidate-set receipt differs from the current local inputs");
  } else fail("Usage: link-unsigned-candidate-set.mjs run-twice <runic.release.json> <staging-root> [role:receipt] | verify-twice <runic.release.json> <staging-root> <receipt.json> [role:receipt]");
}

if (import.meta.main) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
