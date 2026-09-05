# Contributing to Runic Artifex

SDK development takes place in [runic-sdk](https://github.com/Runic-Artifex/runic-sdk).
Follow its [contributor guide](https://github.com/Runic-Artifex/runic-sdk/blob/main/CONTRIBUTING.md)
for coordinated changes across libraries, tools, applications and documentation.

Before opening a change, check the repository's README and existing issues for
product-specific guidance. Keep a pull request focused on one product boundary,
include tests appropriate to its risk, and update public API or protocol evidence
when behavior changes.

All repositories use exact dependency versions and must remain free of NuGet
`packages.lock.json` files and dependencies on sibling repository checkouts. Explicit source references
within the SDK monorepo are supported. Generated files
must be reproducible by the checked-in tooling.

Pull requests should explain:

- what changed and why;
- compatibility and NativeAOT implications;
- which local checks were run;
- whether package identities, protocols, or public APIs changed.

By participating, you agree to follow the organization code of conduct.
