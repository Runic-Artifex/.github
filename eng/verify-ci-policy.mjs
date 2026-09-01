import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

function fail(message) {
  throw new Error(`CI policy verification failed: ${message}`);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }

  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} keys must be exactly: ${wanted.join(", ")}`);
  }
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    fail(`${label} must be a positive integer`);
  }
}

export function verifyCiPolicy(policy, releaseAuthority) {
  exactKeys(
    policy,
    ["$schema", "schemaVersion", "toolchain", "registry", "stages", "retention"],
    "policy"
  );
  if (policy.$schema !== "./runic.ci.schema.json" || policy.schemaVersion !== 1) {
    fail("schema identity must be runic.ci.schema.json version 1");
  }

  exactKeys(policy.toolchain, ["bun", "node", "npmPublisher"], "toolchain");
  for (const [name, version] of Object.entries(policy.toolchain)) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      fail(`toolchain.${name} must be an exact version`);
    }
  }

  exactKeys(
    policy.registry,
    ["owner", "npm", "nuget", "candidateMarker", "revisionLength"],
    "registry"
  );
  if (policy.registry.owner !== "Runic-Artifex") {
    fail("registry.owner must be Runic-Artifex");
  }
  if (policy.registry.npm !== "https://npm.pkg.github.com") {
    fail("registry.npm must use GitHub Packages");
  }
  if (policy.registry.nuget !== "https://nuget.pkg.github.com/Runic-Artifex/index.json") {
    fail("registry.nuget must use GitHub Packages");
  }
  if (policy.registry.candidateMarker !== "-ci.sha") {
    fail("registry.candidateMarker must be -ci.sha");
  }
  if (
    !Number.isInteger(policy.registry.revisionLength) ||
    policy.registry.revisionLength < 12 ||
    policy.registry.revisionLength > 40
  ) {
    fail("registry.revisionLength must be an integer between 12 and 40");
  }

  if (!Array.isArray(policy.stages) || policy.stages.length === 0) {
    fail("stages must be a non-empty array");
  }

  const releaseRepositories = new Set(
    releaseAuthority.repositories.map((repository) => repository.currentIdentity)
  );
  const stageIds = new Set();
  for (const stage of policy.stages) {
    exactKeys(stage, ["id", "kind", "repositories", "after"], `stage ${stage.id ?? "<unknown>"}`);
    if (!/^[a-z][a-z0-9-]*$/.test(stage.id) || stageIds.has(stage.id)) {
      fail(`stage id must be unique kebab-case: ${stage.id}`);
    }
    stageIds.add(stage.id);
    if (!["materialize", "validate"].includes(stage.kind)) {
      fail(`stage ${stage.id} kind must be materialize or validate`);
    }
    if (!Array.isArray(stage.repositories) || stage.repositories.length === 0) {
      fail(`stage ${stage.id} must contain repositories`);
    }
    if (new Set(stage.repositories).size !== stage.repositories.length) {
      fail(`stage ${stage.id} contains duplicate repositories`);
    }
    for (const repository of stage.repositories) {
      if (!releaseRepositories.has(repository)) {
        fail(`stage ${stage.id} references unknown repository ${repository}`);
      }
    }
    if (!Array.isArray(stage.after) || new Set(stage.after).size !== stage.after.length) {
      fail(`stage ${stage.id}.after must contain unique stage ids`);
    }
  }

  const stagesById = new Map(policy.stages.map((stage) => [stage.id, stage]));
  for (const stage of policy.stages) {
    for (const dependency of stage.after) {
      if (!stagesById.has(dependency)) {
        fail(`stage ${stage.id} depends on unknown stage ${dependency}`);
      }
      if (dependency === stage.id) {
        fail(`stage ${stage.id} cannot depend on itself`);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(stageId) {
    if (visiting.has(stageId)) {
      fail(`stage graph contains a cycle at ${stageId}`);
    }
    if (visited.has(stageId)) {
      return;
    }
    visiting.add(stageId);
    for (const dependency of stagesById.get(stageId).after) {
      visit(dependency);
    }
    visiting.delete(stageId);
    visited.add(stageId);
  }
  for (const stageId of stageIds) {
    visit(stageId);
  }

  exactKeys(
    policy.retention,
    [
      "minimumAgeDays",
      "expirationGraceDays",
      "keepSuccessfulPerPackage",
      "automaticDeletion"
    ],
    "retention"
  );
  positiveInteger(policy.retention.minimumAgeDays, "retention.minimumAgeDays");
  positiveInteger(policy.retention.expirationGraceDays, "retention.expirationGraceDays");
  positiveInteger(
    policy.retention.keepSuccessfulPerPackage,
    "retention.keepSuccessfulPerPackage"
  );
  if (policy.retention.automaticDeletion !== false) {
    fail("automatic deletion must remain disabled until the dry-run rollout is approved");
  }
}

export function readAndVerifyCiPolicy(policyPath = path.join(root, "runic.ci.json")) {
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const releaseAuthority = JSON.parse(
    fs.readFileSync(path.join(path.dirname(policyPath), "runic.release.json"), "utf8")
  );
  verifyCiPolicy(policy, releaseAuthority);
  return policy;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  readAndVerifyCiPolicy(process.argv[2]);
  console.log("CI policy verification passed.");
}
