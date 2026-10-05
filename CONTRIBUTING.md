# Contributing to Runic Artifex

SDK development takes place in the repository that owns the product:
[Runic SDK](https://github.com/Runic-Artifex/runic-sdk),
[Runic CLI SDK](https://github.com/Runic-Artifex/runic-cli-sdk), or
[Runic Translations SDK](https://github.com/Runic-Artifex/runic-translations-sdk).
Follow that repository's contributor guide for product-specific changes.

Before opening a change, check the repository's README and existing issues for
product-specific guidance. Keep a pull request focused on one product boundary,
include tests appropriate to the changed behavior, and update API/protocol
documentation when behavior changes. Use focused checks locally and rely on
GitHub for complete CI. Product releases follow the owning repository's guide,
without legacy organization-level evidence or manual acceptance requirements.

All repositories use exact dependency versions and must remain free of NuGet
`packages.lock.json` files and dependencies on sibling repository checkouts.
Generated files must be reproducible by the checked-in tooling.

Pull requests should explain:

- what changed and why;
- compatibility and NativeAOT implications;
- which local checks were run;
- whether package identities, protocols, or public APIs changed.

By participating, you agree to follow the organization code of conduct.
