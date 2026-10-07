![Runic Artifex banner](.github/assets/brand/banner.png)

# Runic Artifex organization repository

This is the organization-level `.github` repository. It centralizes public
GitHub defaults and organization-wide records that are useful across Runic
Artifex repositories.

## What belongs here

- Community-health defaults, issue templates, and ownership guidance for public
  repositories.
- The reusable [release-artifact validation action](.github/actions/validate-release-artifacts).
- Shared release and CI records, schemas, verifiers, and retained evidence.
- Public organization profile and support information.

The maintainer's `local-planning` repository owns product and organization
planning. Contributor guidance, CI, package inventories,
and releases remain owned by their product repositories. Each Runic SDK product
maintains its own release policy:
[Runic SDK](https://github.com/Runic-Artifex/runic-sdk/blob/main/eng/release/README.md),
[Runic CLI SDK](https://github.com/Runic-Artifex/runic-cli-sdk/blob/main/eng/release/README.md)
and [Runic Translations SDK](https://github.com/Runic-Artifex/runic-translations-sdk/blob/main/eng/release/README.md).

The former multi-repository candidate train is retired. Its manifests,
tools and evidence remain in this repository as historical records;
they do not authorize or gate current product releases.

For the retained records, see [release authority](RELEASES.md) and [CI policy](CI.md).
