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

## Release-validation inventory

Release-facing pipeline changes are checked locally at the exact compatibility
revision before they are pushed. The command shown below is repository-owned;
CI invokes that same command after selecting the authority-pinned candidates.
An outer `nix develop --command` is permitted locally to supply the pinned
toolchain and does not change the command being verified.

| Repository | Portable local/CI command | Exact target |
| --- | --- | --- |
| `.github` | `node --test eng/verify-release-manifest.test.mjs eng/verify-compatibility-set.test.mjs eng/release-evidence.test.mjs eng/link-unsigned-candidate-set.test.mjs eng/verify-ci-policy.test.mjs` followed by the three `node eng/verify-*.mjs` commands in `release-authority.yml` | committed release, compatibility, CI, and evidence authority plus the materialized compatibility workspace |
| `runic-command-line` | `./eng/verify.sh` | source plus locally packed and clean-consumed Command Line candidates |
| `runic-desktop` | `bun run test`, `./eng/verify-web-package.sh`, managed restore/build/test, and `./eng/verify-local-package.sh linux-x64` | Desktop transport, Linux WebView, exact npm/NuGet packages, and NativeAOT consumer |
| `runic-assets` | `./eng/verify.sh` | source plus locally packed and clean-consumed Assets candidates |
| `runic-translations` | `RUNIC_PACKAGE_VERSION="$PACKAGE_VERSION" ./eng/verify.sh` | source plus the selected immutable Translations candidate version |
| `runic-toolkit` | `./eng/verify.sh` | exact upstream candidates, all application templates, packages, browser smoke, and Linux NativeAOT |
| `runic-svelte` | `bun install --frozen-lockfile` and `bun run verify` | exact lock plus Svelte/SvelteKit package and consumer checks |
| `runic-vite` | `bun install --frozen-lockfile` and `bun run verify` | exact lock plus Vite package and consumer checks |
| `runic-toolkit-examples` | `bun run verify` after `eng/export-ci-candidates.mjs` and the workflow's exact candidate preparation | package-only samples, canaries, frontend production builds, and Linux NativeAOT consumers |
| `runic-translations-editor` | `./verify.sh` | exact registry candidates, Editor/frontend product checks, recovery smoke, hosted browser, and unsigned staging contract |
| `runic-docs` | `npm ci`, `npm audit --omit=dev --audit-level=high`, `npm run lint`, `npm run check:release-data`, `npm run check`, and `npm test` | authority-pinned generated data, documentation checks, and production build |

Each portable run ends with the repository's unchanged-source check where the
workflow defines one. Candidate-producing repositories additionally pack and
clean-consume the exact candidate bytes; a green source-only run is not a
release-candidate result.

The following checks are genuinely host-specific and are not replaced by a
Linux simulation:

- Runic Desktop's `native-platforms` matrix runs the managed parity corpus,
  real WebView smoke, and same-host comparative stress on `win-x64`,
  `osx-x64`, and `osx-arm64`. It runs on a `v*` candidate tag or manual
  dispatch; `native-evidence` then independently verifies all three raw
  receipts and closes their exact revisions, toolchain, workload, host
  profiles, and digests into one matrix receipt. A matching local
  Windows/macOS VM may run the same repository commands before dispatch.
- Runic Toolkit's `application-bridge-windows` job runs the managed Desktop
  bridge suites and Windows NativeAOT consumer on `windows-2025`. A Windows VM
  is the local fallback; Linux evidence does not certify this lane.
- Translations Editor's `cross-platform` job runs `./eng/editor-smoke.ps1` on
  `windows-2025` and `macos-15`; preview and stable staging workflows own the
  corresponding extracted-package checks. A matching local VM may run the same
  script, otherwise hosted CI is the required evidence source.

Signing, notarization, registry upload, candidate retention deletion, and
public-release dispatch are external authorization steps, not portable
pre-push validation. Local validation must not attempt them.

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
