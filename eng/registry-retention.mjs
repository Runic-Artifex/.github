const DAY_MS = 24 * 60 * 60 * 1000;

function coordinate(version) {
  return `${version.ecosystem.toLowerCase()}:${version.package.toLowerCase()}:${version.version}`;
}

function addReason(reasons, key, reason) {
  const values = reasons.get(key) ?? new Set();
  values.add(reason);
  reasons.set(key, values);
}

export function planRegistryRetention(inventory, policy, now = new Date()) {
  const marker = policy.candidateMarker.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
  const candidatePattern = new RegExp(
    `^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)${marker}[0-9a-f]{${policy.revisionLength}}$`
  );
  const isCandidate = (version) => candidatePattern.test(version.version);
  const versions = inventory.versions ?? [];
  const roots = inventory.roots ?? [];
  const byCoordinate = new Map(versions.map((version) => [coordinate(version), version]));
  const reasons = new Map();
  const missingDependencies = [];

  for (const root of roots) {
    const key = coordinate(root);
    if (byCoordinate.has(key)) {
      addReason(reasons, key, `root:${root.reason}`);
    }
  }

  const successfulByPackage = new Map();
  for (const version of versions) {
    if (!isCandidate(version) || version.successful === false) {
      continue;
    }
    const key = `${version.ecosystem.toLowerCase()}:${version.package.toLowerCase()}`;
    const values = successfulByPackage.get(key) ?? [];
    values.push(version);
    successfulByPackage.set(key, values);
  }
  for (const values of successfulByPackage.values()) {
    values
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, policy.keepSuccessfulPerPackage)
      .forEach((version) => addReason(reasons, coordinate(version), "recent-success"));
  }

  for (const version of versions) {
    const ageDays = (now.getTime() - Date.parse(version.createdAt)) / DAY_MS;
    if (ageDays < policy.minimumAgeDays) {
      addReason(reasons, coordinate(version), "minimum-age");
    }
  }

  const queue = [...reasons.keys()];
  const traversed = new Set();
  while (queue.length > 0) {
    const key = queue.shift();
    if (traversed.has(key)) {
      continue;
    }
    traversed.add(key);
    const version = byCoordinate.get(key);
    for (const dependency of version?.dependencies ?? []) {
      const dependencyKey = coordinate(dependency);
      if (!byCoordinate.has(dependencyKey)) {
        missingDependencies.push({ dependent: key, dependency: dependencyKey });
        continue;
      }
      const wasRetained = reasons.has(dependencyKey);
      addReason(reasons, dependencyKey, `dependency-of:${key}`);
      if (!wasRetained) {
        queue.push(dependencyKey);
      }
    }
  }

  const entries = versions.map((version) => {
    const key = coordinate(version);
    const retainedFor = [...(reasons.get(key) ?? [])].sort();
    const candidate = isCandidate(version);
    const ageDays = (now.getTime() - Date.parse(version.createdAt)) / DAY_MS;
    let action;

    if (!candidate) {
      action = "protect";
      retainedFor.push("non-candidate");
    } else if (retainedFor.length > 0) {
      action = "retain";
    } else if (ageDays < policy.minimumAgeDays + policy.expirationGraceDays) {
      action = "expire";
      retainedFor.push("expiration-grace");
    } else {
      action = policy.automaticDeletion ? "delete" : "would-delete";
    }

    return {
      ...version,
      action,
      retainedFor: [...new Set(retainedFor)].sort()
    };
  });

  return {
    generatedAt: now.toISOString(),
    entries,
    missingDependencies,
    summary: Object.fromEntries(
      ["protect", "retain", "expire", "would-delete", "delete"].map((action) => [
        action,
        entries.filter((entry) => entry.action === action).length
      ])
    )
  };
}
