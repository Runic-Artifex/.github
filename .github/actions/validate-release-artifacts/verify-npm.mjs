#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const [, , version, suppliedDirectory, repositoryUrl, repositoryCommit, suppliedCount] = process.argv;
const expectedCount = Number.parseInt(suppliedCount, 10);
if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u.test(version ?? "")) {
  throw new Error(`Invalid package version '${version}'.`);
}
if (!/^[0-9a-f]{40}$/iu.test(repositoryCommit ?? "")) {
  throw new Error("Repository commit must be a full Git commit.");
}
if (!Number.isSafeInteger(expectedCount) || expectedCount < 1) {
  throw new Error("Expected npm artifact count must be positive.");
}

const directory = resolve(suppliedDirectory);
const archives = readdirSync(directory).filter((file) => file.endsWith(".tgz")).sort();
if (archives.length !== expectedCount) {
  throw new Error(`Expected ${expectedCount} npm packages, found ${archives.length}.`);
}

const names = new Set();
const expectedRepository = `git+${repositoryUrl.replace(/\/$/u, "")}.git`;
for (const archive of archives) {
  const archivePath = resolve(directory, archive);
  const manifestResult = spawnSync("tar", ["-xOf", archivePath, "package/package.json"], { encoding: "utf8" });
  const entriesResult = spawnSync("tar", ["-tzf", archivePath], { encoding: "utf8" });
  if (manifestResult.status !== 0 || entriesResult.status !== 0) {
    throw new Error(`Could not inspect ${archive}.`);
  }

  const manifest = JSON.parse(manifestResult.stdout);
  const entries = entriesResult.stdout.split("\n").filter(Boolean);
  if (typeof manifest.name !== "string" || !manifest.name.startsWith("@runic-artifex/") || names.has(manifest.name)) {
    throw new Error(`${archive} has an invalid or duplicate package name '${manifest.name}'.`);
  }
  names.add(manifest.name);
  if (manifest.version !== version) throw new Error(`${manifest.name} has version '${manifest.version}'.`);
  if (manifest.private === true) throw new Error(`${manifest.name} is marked private.`);
  if (manifest.license !== "MIT") throw new Error(`${manifest.name} must use MIT.`);
  if (typeof manifest.description !== "string" || manifest.description.length < 20) {
    throw new Error(`${manifest.name} must provide a meaningful description.`);
  }
  if (manifest.repository?.url !== expectedRepository) {
    throw new Error(`${manifest.name} has invalid repository provenance.`);
  }
  if (manifest.gitHead !== repositoryCommit) {
    throw new Error(`${manifest.name} has gitHead '${manifest.gitHead}'; expected '${repositoryCommit}'.`);
  }
  if (manifest.publishConfig?.registry !== "https://registry.npmjs.org" || manifest.publishConfig?.access !== "public") {
    throw new Error(`${manifest.name} is not staged for public npm publication.`);
  }
  if (!entries.includes("package/README.md")) throw new Error(`${manifest.name} does not include README.md.`);
  if (!entries.some((entry) => entry.startsWith("package/dist/"))) {
    throw new Error(`${manifest.name} does not include built distribution files.`);
  }

  for (const field of ["dependencies", "optionalDependencies"]) {
    for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
      if (dependency.startsWith("@runic-artifex/") && range !== version) {
        throw new Error(`${manifest.name} does not pin ${dependency} to ${version}.`);
      }
    }
  }
  for (const [dependency, range] of Object.entries(manifest.peerDependencies ?? {})) {
    if (!dependency.startsWith("@runic-artifex/")) continue;
    if (
      typeof range !== "string" ||
      range.trim().length === 0 ||
      /^(?:\*|latest|workspace:|file:|https?:|git(?:\+|:))/iu.test(range.trim())
    ) {
      throw new Error(`${manifest.name} has an unbounded or non-registry peer range for ${dependency}.`);
    }
  }
}

console.log(`Validated ${expectedCount} public npm artifacts for ${version}.`);
