#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const shaPattern = /^[a-f0-9]{64}$/;
const revisionPattern = /^[a-f0-9]{40}$/;
const orderedVersionPattern = /^\d+\.\d+\.\d+-preview\.[1-9]\d*$/;
const exactToolPattern = /^\d+\.\d+\.\d+$/;
const requiredPlatforms = ["linux-x64", "osx-arm64", "osx-x64", "win-x64"];
const packageKey = (item) => `${item.ecosystem}:${item.identity.toLowerCase()}`;

function duplicateErrors(items, key, path) {
  const seen = new Set();
  const errors = [];
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) errors.push(`${path}: duplicate '${value}'`);
    seen.add(value);
  }
  return errors;
}

export function verifyCompatibilitySet(candidate, schema, releaseManifest) {
  const errors = [];
  const required = ["$schema", "schemaVersion", "id", "releaseTrainVersion", "publication", "toolchain", "languageProfiles", "platformProfiles", "sources", "contracts", "packages"];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return ["$: must be an object"];
  for (const key of required) if (!(key in candidate)) errors.push(`$.${key}: is required`);
  for (const key of Object.keys(candidate)) if (!required.includes(key)) errors.push(`$.${key}: additional properties are not allowed`);
  if (candidate.$schema !== "./runic.compatibility-set.schema.json") errors.push("$.$schema: must select the canonical compatibility-set schema");
  if (schema?.$id !== "https://runic.artifex/schemas/compatibility-set/1") errors.push("schema: unexpected compatibility-set schema identity");
  if (candidate.schemaVersion !== 1) errors.push("$.schemaVersion: must be 1");
  if (candidate.publication !== "forbidden") errors.push("$.publication: compatibility selection must not authorize publication");
  if (!orderedVersionPattern.test(candidate.releaseTrainVersion ?? "")) errors.push("$.releaseTrainVersion: must be an ordered preview version");
  if (/-[a-f0-9]{7,}(?:\.|$)/i.test(candidate.releaseTrainVersion ?? "")) errors.push("$.releaseTrainVersion: hash-shaped prerelease labels are forbidden");

  const toolchain = candidate.toolchain ?? {};
  for (const name of ["dotnetSdk", "node", "npm"]) if (!exactToolPattern.test(toolchain[name] ?? "")) errors.push(`$.toolchain.${name}: must be an exact numeric version`);
  const expectedLanguageProfiles = { v1: [{ language: "csharp", role: "application-backend", state: "supported" }, { language: "typescript-effect", role: "frontend", state: "supported" }], postV1: [{ language: "rust", role: "native-and-backend", state: "unassigned" }, { language: "cpp", role: "native-and-backend", state: "unassigned" }] };
  if (JSON.stringify(candidate.languageProfiles) !== JSON.stringify(expectedLanguageProfiles)) errors.push("$.languageProfiles: must select the C# backend and TypeScript+Effect frontend for v1 while leaving Rust and C++ unassigned post-v1");
  const profiles = Array.isArray(candidate.platformProfiles) ? candidate.platformProfiles : [];
  if (JSON.stringify([...profiles].sort()) !== JSON.stringify(requiredPlatforms)) errors.push("$.platformProfiles: must select the four certified desktop profiles exactly once");

  const sources = Array.isArray(candidate.sources) ? candidate.sources : [];
  errors.push(...duplicateErrors(sources, (item) => item.repository, "$.sources"));
  const sourceMap = new Map(sources.map((item) => [item.repository, item]));
  for (const [index, source] of sources.entries()) {
    if (!source.repository || source.url !== `https://github.com/Runic-Artifex/${source.repository}`) errors.push(`$.sources[${index}]: repository URL does not match its identity`);
    if (!revisionPattern.test(source.revision ?? "")) errors.push(`$.sources[${index}].revision: must be a full Git revision`);
  }

  const contracts = Array.isArray(candidate.contracts) ? candidate.contracts : [];
  errors.push(...duplicateErrors(contracts, (item) => item.id, "$.contracts"));
  for (const [index, contract] of contracts.entries()) {
    if (!sourceMap.has(contract.repository)) errors.push(`$.contracts[${index}].repository: unknown source`);
    if (contract.algorithm !== "sha256-git-file-set-v1") errors.push(`$.contracts[${index}].algorithm: unsupported fingerprint algorithm`);
    if (!shaPattern.test(contract.sha256 ?? "")) errors.push(`$.contracts[${index}].sha256: invalid digest`);
    if (!/^[A-Za-z0-9][A-Za-z0-9./-]+$/.test(contract.path ?? "") || contract.path.includes("..")) errors.push(`$.contracts[${index}].path: invalid repository-relative path`);
  }

  const packages = Array.isArray(candidate.packages) ? candidate.packages : [];
  errors.push(...duplicateErrors(packages, packageKey, "$.packages"));
  for (const [index, item] of packages.entries()) {
    if (!["nuget", "npm"].includes(item.ecosystem)) errors.push(`$.packages[${index}].ecosystem: unsupported ecosystem`);
    if (!item.identity) errors.push(`$.packages[${index}].identity: is required`);
    if (!orderedVersionPattern.test(item.version ?? "")) errors.push(`$.packages[${index}].version: must be an exact ordered preview version`);
    if (/-[a-f0-9]{7,}(?:\.|$)/i.test(item.version ?? "")) errors.push(`$.packages[${index}].version: hash-shaped prerelease labels are forbidden`);
    if (!sourceMap.has(item.source)) errors.push(`$.packages[${index}].source: unknown source`);
  }

  const canonical = new Set((releaseManifest?.canonicalPackages ?? []).map(packageKey));
  const selected = new Set(packages.map(packageKey));
  for (const key of canonical) if (!selected.has(key)) errors.push(`$.packages: missing canonical package '${key}'`);
  for (const key of selected) if (!canonical.has(key)) errors.push(`$.packages: package '${key}' is not canonical release authority`);
  return errors;
}

function git(repositoryPath, args) {
  const result = spawnSync("git", ["-C", repositoryPath, ...args], { encoding: null });
  if (result.status !== 0) throw new Error(result.stderr.toString("utf8").trim() || `git ${args[0]} failed`);
  return result.stdout;
}

function gitJson(repositoryPath, revision, path) {
  return JSON.parse(git(repositoryPath, ["show", `${revision}:${path}`]).toString("utf8"));
}

export function contractDigest(repositoryPath, revision, path) {
  const files = git(repositoryPath, ["ls-tree", "-r", "--name-only", revision, "--", path])
    .toString("utf8").split("\n").filter(Boolean).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  if (files.length === 0) throw new Error(`contract path '${path}' is empty at ${revision}`);
  const set = createHash("sha256");
  for (const file of files) {
    const content = git(repositoryPath, ["show", `${revision}:${file}`]);
    set.update(`${createHash("sha256").update(content).digest("hex")}  ${file}\n`);
  }
  return set.digest("hex");
}

export function verifyWorkspace(candidate, workspace) {
  const errors = [];
  const sources = new Map(candidate.sources.map((item) => [item.repository, item]));
  for (const source of sources.values()) {
    try { git(resolve(workspace, source.repository), ["cat-file", "-e", `${source.revision}^{commit}`]); }
    catch (error) { errors.push(`${source.repository}: pinned revision is unavailable (${error.message})`); }
  }
  for (const contract of candidate.contracts) {
    const source = sources.get(contract.repository);
    if (!source) continue;
    try {
      const actual = contractDigest(resolve(workspace, source.repository), source.revision, contract.path);
      if (actual !== contract.sha256) errors.push(`${contract.id}: contract fingerprint mismatch (${actual})`);
    } catch (error) { errors.push(`${contract.id}: ${error.message}`); }
  }
  const managedSources = new Set(["runic-toolkit", "runic-desktop", "runic-command-line", "runic-assets", "runic-translations", "runic-translations-editor", "runic-toolkit-examples"]);
  const nodeManifests = new Map([["runic-toolkit", "package.json"], ["runic-desktop", "package.json"], ["runic-translations", "web/package.json"], ["runic-translations-editor", "Frontend/package.json"], ["runic-svelte", "package.json"], ["runic-vite", "package.json"], ["runic-toolkit-examples", "package.json"]]);
  for (const source of sources.values()) {
    const repositoryPath = resolve(workspace, source.repository);
    if (managedSources.has(source.repository)) {
      try {
        const globalJson = gitJson(repositoryPath, source.revision, "global.json");
        if (globalJson?.sdk?.version !== candidate.toolchain.dotnetSdk) errors.push(`${source.repository}: global.json SDK '${globalJson?.sdk?.version ?? "missing"}' disagrees with compatibility toolchain '${candidate.toolchain.dotnetSdk}'`);
      } catch (error) { errors.push(`${source.repository}: cannot verify global.json (${error.message})`); }
    }
    const manifestPath = nodeManifests.get(source.repository);
    if (manifestPath) {
      try {
        const manifest = gitJson(repositoryPath, source.revision, manifestPath);
        if (manifest.packageManager !== `npm@${candidate.toolchain.npm}`) errors.push(`${source.repository}: ${manifestPath} packageManager '${manifest.packageManager ?? "missing"}' disagrees with compatibility npm '${candidate.toolchain.npm}'`);
        if (!String(manifest.engines?.node ?? "").includes(candidate.toolchain.node.slice(0, candidate.toolchain.node.lastIndexOf(".")))) errors.push(`${source.repository}: ${manifestPath} does not declare compatibility with Node '${candidate.toolchain.node}'`);
      } catch (error) { errors.push(`${source.repository}: cannot verify ${manifestPath} (${error.message})`); }
    }
  }
  return errors;
}

const load = (path) => JSON.parse(readFileSync(resolve(path), "utf8"));
if (import.meta.url === `file://${process.argv[1]}`) {
  const [setPath, schemaPath, releasePath, workspace] = process.argv.slice(2);
  if (!setPath || !schemaPath || !releasePath) {
    console.error("Usage: node eng/verify-compatibility-set.mjs <set.json> <schema.json> <release.json> [workspace]");
    process.exitCode = 2;
  } else {
    try {
      const candidate = load(setPath);
      const errors = verifyCompatibilitySet(candidate, load(schemaPath), load(releasePath));
      if (workspace) errors.push(...verifyWorkspace(candidate, workspace));
      if (errors.length) { errors.forEach((error) => console.error(error)); process.exitCode = 1; }
    } catch (error) { console.error(`compatibility-set verification failed: ${error.message}`); process.exitCode = 2; }
  }
}
