# CI architecture

The organization CI policy is machine-readable in
[`runic.ci.json`](runic.ci.json). It owns the shared toolchain, GitHub Packages
endpoints, dependency stages, and candidate retention rules. Package inventory
continues to have one owner: [`runic.release.json`](runic.release.json).

## Candidate packages

Verified package-producing jobs publish immutable development candidates to
GitHub Packages. A source revision always maps to the same coordinate:

```
<semver-core>-ci.sha<first-16-characters-of-the-full-git-sha>
```

A rerun must reuse an existing candidate only when its digest and provenance
match. It must never overwrite or silently replace a coordinate. Downstream
jobs consume the exact candidate selected by the compatibility authority; they
do not rebuild upstream repositories.

GitHub Packages access must be granted explicitly to consuming repositories.
Workflows use their repository-scoped `GITHUB_TOKEN`; long-lived personal
access tokens are not part of the CI design.

## Build and publication order

The enforced stage graph is:

1. materialize Command Line, Desktop, and Vite candidates;
2. materialize Assets and Translations against those candidates;
3. materialize Toolkit/Application Bridge;
4. materialize Svelte and SvelteKit;
5. validate Toolkit templates, examples, and the Translations Editor against
   the complete candidate set.

This separates candidate materialization from integrated validation and breaks
the current Toolkit/Svelte source-build cycle. If a selected upstream
coordinate is not available, a dependent train waits or is reported as
blocked. It does not fall back to building another repository from source.

Public publishing is promotion of the already verified package files. Packages
are promoted in dependency order, and a dependent is not published until each
referenced upstream version is available in the public registry. The npm CLI is
retained only for the final OIDC-backed npmjs.org publish; Bun owns JavaScript
install, workspace execution, caching, and package construction in CI.
Exact public-version tarballs cross the protected publication boundary through
a private GitHub Packages `release-staging` tag. The public job downloads and
revalidates those bytes; it does not rebuild them or use an Actions artifact as
the package handoff.

Changes roll out in this order:

1. merge the `.github` authority and shared verification;
2. merge candidate producers in the materialization order above;
3. grant each dependent repository Actions access to its upstream packages;
4. enable dependent consumption only after those exact candidates exist;
5. merge the dashboard snapshot after the policy is present on authority
   `main`.

## Cache policy

Repositories pin Bun to the version in `runic.ci.json`, commit `bun.lock`,
and run `bun install --frozen-lockfile`. GitHub Actions caches Bun's global
download cache using the operating system, Bun version, and lockfile digest.
Build outputs are cached only when their keys also include every relevant
source revision and toolchain version. A cache accelerates work; it is never a
release input or the authority for a package.

## Registry retention

Only versions containing the reserved `-ci.sha` marker are eligible for
automated cleanup. Public and release-staging versions are always protected.
The weekly retention report marks:

- versions referenced by the active compatibility set;
- the newest five successfully published versions per package;
- versions younger than 30 days;
- exact upstream dependencies of any retained candidate.

An unreachable candidate first spends seven days in the expiration window.
After that it is reported as `would-delete`. Automatic deletion is disabled
in policy while the inventory and dashboard are being proven. The report is
uploaded for 14 days and copied into the workflow summary.

Before deletion is enabled, the collector must also ingest compatibility sets
from open authority pull requests and exact dependency metadata from candidate
provenance. Package deletion access must be granted explicitly to this
repository, and cleanup must remain limited to the reserved candidate marker.
