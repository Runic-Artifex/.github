import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { candidateVersion } from "./candidate-version.mjs";
import { planRegistryRetention } from "./registry-retention.mjs";
import { verifyCiPolicy } from "./verify-ci-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(fs.readFileSync(path.join(root, "runic.ci.json"), "utf8"));
const releaseAuthority = JSON.parse(
  fs.readFileSync(path.join(root, "runic.release.json"), "utf8")
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("canonical CI policy verifies", () => {
  assert.doesNotThrow(() => verifyCiPolicy(policy, releaseAuthority));
});

test("stage cycles are rejected", () => {
  const changed = clone(policy);
  changed.stages[0].after = ["integrated-validation"];
  assert.throws(() => verifyCiPolicy(changed, releaseAuthority), /cycle/);
});

test("unknown repositories are rejected", () => {
  const changed = clone(policy);
  changed.stages[0].repositories.push("runic-unknown");
  assert.throws(() => verifyCiPolicy(changed, releaseAuthority), /runic-unknown/);
});

test("candidate versions are deterministic and immutable per revision", () => {
  const revision = "0123456789abcdef0123456789abcdef01234567";
  assert.equal(candidateVersion("1.0.0", revision), "1.0.0-ci.sha0123456789abcdef");
  assert.equal(candidateVersion("1.0.0", revision), candidateVersion("1.0.0", revision));
  assert.throws(() => candidateVersion("1.0.0-preview.1", revision), /SemVer core/);
});

test("retention follows roots and dependencies transitively", () => {
  const old = "2026-01-01T00:00:00.000Z";
  const inventory = {
    roots: [
      {
        ecosystem: "npm",
        package: "@runic-artifex/consumer",
        version: "1.0.0-ci.shacccccccccccccccc",
        reason: "active-train"
      }
    ],
    versions: [
      {
        ecosystem: "npm",
        package: "@runic-artifex/consumer",
        version: "1.0.0-ci.shacccccccccccccccc",
        createdAt: old,
        dependencies: [
          {
            ecosystem: "npm",
            package: "@runic-artifex/dependency",
            version: "1.0.0-ci.shadddddddddddddddd"
          }
        ]
      },
      {
        ecosystem: "npm",
        package: "@runic-artifex/dependency",
        version: "1.0.0-ci.shadddddddddddddddd",
        createdAt: old
      }
    ]
  };
  const retention = {
    ...policy.registry,
    ...policy.retention,
    keepSuccessfulPerPackage: 1
  };
  const plan = planRegistryRetention(inventory, retention, new Date("2026-09-01T00:00:00Z"));
  assert.equal(plan.entries[0].action, "retain");
  assert.equal(plan.entries[1].action, "retain");
  assert.match(plan.entries[1].retainedFor[0], /^dependency-of:/);
});

test("old unreachable candidates are reported, never deleted in dry-run mode", () => {
  const inventory = {
    roots: [],
    versions: [
      {
        ecosystem: "npm",
        package: "@runic-artifex/example",
        version: "1.0.0-ci.sha0000000000000000",
        createdAt: "2026-01-01T00:00:00.000Z",
        successful: false
      },
      {
        ecosystem: "npm",
        package: "@runic-artifex/example",
        version: "1.0.0",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  };
  const retention = { ...policy.registry, ...policy.retention };
  const plan = planRegistryRetention(inventory, retention, new Date("2026-09-01T00:00:00Z"));
  assert.equal(plan.entries[0].action, "would-delete");
  assert.equal(plan.entries[1].action, "protect");
  assert.equal(plan.summary.delete, 0);
});

test("public versions do not consume the recent-candidate retention budget", () => {
  const inventory = {
    roots: [],
    versions: [
      {
        ecosystem: "npm",
        package: "@runic-artifex/example",
        version: "1.0.0-ci.sha1111111111111111",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      {
        ecosystem: "npm",
        package: "@runic-artifex/example",
        version: "1.0.0",
        createdAt: "2026-08-01T00:00:00.000Z"
      }
    ]
  };
  const retention = {
    ...policy.registry,
    ...policy.retention,
    keepSuccessfulPerPackage: 1
  };
  const plan = planRegistryRetention(inventory, retention, new Date("2026-09-01T00:00:00Z"));
  assert.equal(plan.entries[0].action, "retain");
  assert.deepEqual(plan.entries[0].retainedFor, ["recent-success"]);
  assert.equal(plan.entries[1].action, "protect");
});
