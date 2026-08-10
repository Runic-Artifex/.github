# Runic Artifex release policy

Each product owns its packages and releases independently. Integration packages
belong to the product that implements the integration. Compatibility is recorded
explicitly; repositories do not share a version merely because they share an
organization.

## Versioning and identity

- Packages use SemVer 2.0 and one version across a repository's shipping family.
- Cross-product dependencies use exact versions during the public preview.
- Preview tags use `vMAJOR.MINOR.PATCH-preview.N`; stable tags use
  `vMAJOR.MINOR.PATCH`.
- Public npm packages use the controlled `@runic-artifex` scope. The unhyphenated
  `@runicartifex` scope is retained defensively and is not a second package family.
- Runic Translations uses `RunicTranslations.*` for NuGet packages and code,
  `runic.translations/1` for the protocol family, and
  `@runic-artifex/vite-plugin-runic-translations` for its Vite integration.

## Required evidence

Before a public release is approved, the repository must:

1. restore and verify from a clean checkout of the final `main` commit;
2. produce the exact expected NuGet and npm artifact set;
3. validate MIT metadata, README inclusion, repository provenance, and version;
4. consume the packaged artifacts from an isolated cache;
5. pass applicable NativeAOT and frontend production gates;
6. leave the source tree unchanged;
7. upload the verified artifacts and record their digests before publishing;
8. complete a verify-only `Public release` dispatch for the exact release commit;
9. prove downstream exact-version canaries against the final private candidates.

Green source CI is necessary but is not release-candidate evidence by itself.
A candidate becomes stale when shipping code, package metadata, or provenance
changes after it was produced. A stale version is never rebuilt from a different
commit for another registry.

## Publication

New Runic package families use their top-level
`.github/workflows/public-release.yml`. NuGet and npm trusted-publisher policies
bind to the calling repository, workflow filename, and `public-release`
environment. Long-lived write tokens are not the steady-state publication
mechanism.

CsWebUi retains its established `.github/workflows/nuget-gallery.yml` identity
until its existing NuGet trusted-publisher policy is deliberately migrated.

The first npm.org publication uses a narrowly scoped, short-lived bootstrap token
to create each package record. Immediately afterward, connect each package to its
owning repository's `public-release.yml`, disable token publishing, remove the
bootstrap secret, and use OIDC with provenance for subsequent releases.

## Current first-preview families

Exact first-public versions are recorded in the launch runbook only after fresh
private candidates have passed the final-commit gates.

| Product | Public artifacts | Order constraint |
| --- | --- | --- |
| CsWebUi | Existing NuGet family | Already public |
| Runic Command Line | 4 NuGet packages | Independent |
| Runic Translations | 7 NuGet packages and 1 npm package | Independent; Editor consumes it |
| Runic Toolkit | 15 NuGet packages and `@runic-artifex/application-bridge` | Before exact-version Toolkit integrations |
| Runic Svelte | `@runic-artifex/svelte` and `@runic-artifex/sveltekit` | Same launch window as Toolkit |
| Runic Vite | `@runic-artifex/vite-plugin-runic-toolkit` | Same launch window as Toolkit |
| Runic Assets | 4 NuGet packages | After its exact Toolkit dependency is public |
| Runic Flow | `RunicFlow` and `RunicFlow.ApplicationBridge` | After its exact Toolkit dependency is public |
| Runic Translations Editor | Self-contained application archives | Separate preview after Translations; currently pending |

The retired Flow MVVM/navigation packages are not part of the public train.
Runic Flow is the headless two-package process runtime. Archived Runic Markup is
also not part of the launch.

## Documentation gate

The documentation portal is the public source of truth. Before approving a
package launch, verify that:

1. documentation checks and the production deployment build pass on `main`;
2. every package name, version, dependency direction, and install command matches
   the final workflow artifacts;
3. Flow is described as the headless two-package runtime and Translations uses
   its canonical product, package, protocol, and integration identifiers;
4. source, support, security, license, and registry links resolve publicly;
5. the final hostname has been reviewed and recorded; and
6. the portal does not claim that pending candidates or publication steps are
   complete.

The operational visibility and publication sequence is maintained in
[`LAUNCH.md`](LAUNCH.md).
