import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { planRegistryRetention } from "./registry-retention.mjs";
import { readAndVerifyCiPolicy } from "./verify-ci-policy.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function github(pathname, token) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!response.ok) {
    const error = new Error(
      `GitHub API ${response.status} for ${pathname}: ${await response.text()}`
    );
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function pages(pathname, token) {
  const result = [];
  for (let page = 1; ; page += 1) {
    const separator = pathname.includes("?") ? "&" : "?";
    const values = await github(`${pathname}${separator}per_page=100&page=${page}`, token);
    result.push(...values);
    if (values.length < 100) {
      return result;
    }
  }
}

function packageApiName(owner, entry) {
  if (entry.ecosystem !== "npm") {
    return entry.identity;
  }
  const scope = `@${owner.toLowerCase()}/`;
  return entry.identity.toLowerCase().startsWith(scope)
    ? entry.identity.slice(scope.length)
    : entry.identity;
}

export async function collectInventory(
  owner,
  token,
  compatibilitySet,
  paginate = pages
) {
  const roots = compatibilitySet.packages.map((entry) => ({
    ecosystem: entry.ecosystem,
    package: entry.identity,
    version: entry.version,
    reason: "active-compatibility-set"
  }));
  const versions = [];
  const unavailablePackages = [];

  for (const packageEntry of compatibilitySet.packages) {
    const apiName = packageApiName(owner, packageEntry);
    try {
      const packageVersions = await paginate(
        `/orgs/${encodeURIComponent(owner)}/packages/${packageEntry.ecosystem}/${encodeURIComponent(apiName)}/versions`,
        token
      );
      for (const version of packageVersions) {
        versions.push({
          ecosystem: packageEntry.ecosystem,
          package: packageEntry.identity,
          version: version.name,
          createdAt: version.created_at,
          successful: true,
          dependencies: []
        });
      }
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      unavailablePackages.push({
        ecosystem: packageEntry.ecosystem,
        package: packageEntry.identity,
        reason: "not-found-or-inaccessible"
      });
    }
  }

  return { roots, versions, unavailablePackages };
}

function markdown(plan) {
  const lines = [
    "## GitHub Packages retention dry run",
    "",
    `Generated: ${plan.generatedAt}`,
    "",
    "| Decision | Versions |",
    "| --- | ---: |",
    ...Object.entries(plan.summary).map(([action, count]) => `| ${action} | ${count} |`),
    ""
  ];
  const candidates = plan.entries.filter((entry) =>
    ["expire", "would-delete"].includes(entry.action)
  );
  if (candidates.length === 0) {
    lines.push("No candidate versions are approaching or past deletion eligibility.");
  } else {
    lines.push("| Package | Version | Decision |", "| --- | --- | --- |");
    for (const entry of candidates) {
      lines.push(`| ${entry.package} | ${entry.version} | ${entry.action} |`);
    }
  }
  if (plan.missingDependencies.length > 0) {
    lines.push(
      "",
      `Warning: ${plan.missingDependencies.length} retained dependency coordinates were absent from the inventory.`
    );
  }
  if (plan.unavailablePackages.length > 0) {
    lines.push(
      "",
      `Warning: ${plan.unavailablePackages.length} compatibility-set packages were not found or are not accessible to this workflow.`
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required");
  }

  const policy = readAndVerifyCiPolicy();
  const compatibilitySet = JSON.parse(
    fs.readFileSync(path.join(root, "runic.compatibility-set.json"), "utf8")
  );
  const inventory = await collectInventory(
    policy.registry.owner,
    token,
    compatibilitySet
  );
  const plan = {
    ...planRegistryRetention(
      inventory,
      { ...policy.registry, ...policy.retention },
      new Date()
    ),
    unavailablePackages: inventory.unavailablePackages
  };
  const output = option("--output");
  if (output) {
    fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`);
  }
  const report = markdown(plan);
  process.stdout.write(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
