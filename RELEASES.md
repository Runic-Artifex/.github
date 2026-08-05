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

## Documentation gate

The source of truth for ecosystem documentation is the private
[`Runic-Artifex/runic-docs`](https://github.com/Runic-Artifex/runic-docs)
repository. An owner-only hosted version may be used for launch review, but a
successful deployment is not authorization to make the portal, repositories,
or packages public.

Before approving the first public release, verify that:

1. the documentation CI build and dependency audit pass on `main`;
2. every package name, version, dependency direction, and install command matches
   the artifacts produced by the release workflows;
3. source, support, security, and license links resolve to their intended public
   destinations;
4. the owner-only portal has been reviewed as the release candidate; and
5. the final public hostname and repository visibility sequence are recorded in
   the launch runbook.

The private-repository plan currently permits the `main` deployment policy but
not required environment reviewers. Add Viktor Jannicke as the required reviewer
to every `public-release` environment when the repositories become public and
before configuring either registry as a trusted publisher.

## Initial public preview train

The first publication uses the already verified private-preview versions so
cross-product package dependencies resolve without rewriting their histories:

| Product | Initial public version | Order constraint |
| --- | --- | --- |
| CsWebUi | `2.5.0-beta.4.3` | Already available on nuget.org |
| Runic Command Line | `0.1.0-preview.3.1` | Independent |
| Runic Text Resources | `0.1.0-preview.2.1` | Independent |
| Runic Toolkit | `0.1.0-preview.4.1` | Publish before Toolkit integrations |
| Runic Flow | `0.1.0-preview.4.1` | After Runic Toolkit |
| Runic Assets | `0.1.0-preview.5.1` | After Runic Toolkit |
| Runic Markup | `0.1.0-preview.9.1` | After Runic Toolkit |

Runic Toolkit publishes its NuGet and npm families from the same source commit
and version. Command Line and Text Resources may be released before or after it;
Flow, Assets, and Markup follow only after their exact Toolkit dependencies are
visible on nuget.org.

## npm bootstrap

npm trusted publishers are configured per existing package. The first public
publication therefore requires a narrowly scoped, short-lived bootstrap token.
Immediately afterward, each package is connected to the repository's
`public-release.yml` workflow, token publishing is disabled, and subsequent
releases use OIDC with automatic provenance.
