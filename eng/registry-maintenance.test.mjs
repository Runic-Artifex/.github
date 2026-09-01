import assert from "node:assert/strict";
import test from "node:test";
import { collectInventory } from "./registry-maintenance.mjs";

test("inventory queries authoritative package identities directly", async () => {
  const requests = [];
  const missing = new Error("missing");
  missing.status = 404;
  const inventory = await collectInventory(
    "Runic-Artifex",
    "token",
    {
      packages: [
        {
          ecosystem: "npm",
          identity: "@runic-artifex/svelte",
          version: "1.0.0"
        },
        {
          ecosystem: "nuget",
          identity: "Runic.Application",
          version: "1.0.0"
        }
      ]
    },
    async (pathname) => {
      requests.push(pathname);
      if (pathname.includes("nuget")) {
        throw missing;
      }
      return [
        {
          name: "1.0.0-ci.sha0123456789abcdef",
          created_at: "2026-09-01T00:00:00Z"
        }
      ];
    }
  );

  assert.deepEqual(requests, [
    "/orgs/Runic-Artifex/packages/npm/svelte/versions",
    "/orgs/Runic-Artifex/packages/nuget/Runic.Application/versions"
  ]);
  assert.equal(inventory.versions[0].package, "@runic-artifex/svelte");
  assert.deepEqual(inventory.unavailablePackages, [
    {
      ecosystem: "nuget",
      package: "Runic.Application",
      reason: "not-found-or-inaccessible"
    }
  ]);
});
