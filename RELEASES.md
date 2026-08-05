# Runic Artifex release policy

Each product owns its packages and may release independently. Integration
packages are released by the product named first: for example,
`RunicFlow.RunicToolkit` belongs to Runic Flow.

## Versioning

- Packages use SemVer 2.0 versions.
- A repository releases one version across its package family.
- Dependencies on another Runic Artifex product use an exact version.
- Preview tags use `vMAJOR.MINOR.PATCH-preview.N`; stable tags use
  `vMAJOR.MINOR.PATCH`.
- Compatibility is recorded explicitly; releases are not synchronized merely
  because products share an organization.

## Required evidence

Before a public release is approved, the repository must:

1. restore and verify from a clean checkout;
2. produce the exact expected NuGet and npm artifact set;
3. validate MIT metadata, README inclusion, repository provenance, and version;
4. consume the packaged artifacts from an isolated cache;
5. pass applicable NativeAOT and frontend production gates;
6. leave the source tree unchanged;
7. upload the verified artifacts before any registry job starts.

## Publication

New Runic package families use the top-level workflow
`.github/workflows/public-release.yml`, because NuGet and npm trusted-publisher
policies bind to the calling repository and workflow filename. Registry jobs use
the protected `public-release` environment and OIDC trusted publishing.
Long-lived write tokens are not the steady-state publication mechanism.

CsWebUi retains its established `.github/workflows/nuget-gallery.yml` identity
until its existing NuGet trusted-publisher policy is deliberately migrated.

Publishing stays disabled until product documentation is complete, repositories
are public, package namespaces are controlled, and the registry trusted-publisher
policies have been configured. A manual workflow dispatch may build release
artifacts without publishing at any time.

## npm bootstrap

npm trusted publishers are configured per existing package. The first public
publication therefore requires a narrowly scoped, short-lived bootstrap token.
Immediately afterward, each package is connected to the repository's
`public-release.yml` workflow, token publishing is disabled, and subsequent
releases use OIDC with automatic provenance.
