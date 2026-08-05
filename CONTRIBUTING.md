# Contributing to Runic Artifex

Thank you for helping improve a Runic Artifex project.

Before opening a change, check the repository's README and existing issues for
product-specific guidance. Keep a pull request focused on one product boundary,
include tests appropriate to its risk, and update public API or protocol evidence
when behavior changes.

All repositories use exact dependency versions and must remain free of NuGet
`packages.lock.json` files and sibling source-tree dependencies. Generated files
must be reproducible by the checked-in tooling.

Pull requests should explain:

- what changed and why;
- compatibility and NativeAOT implications;
- which local checks were run;
- whether package identities, protocols, or public APIs changed.

By participating, you agree to follow the organization code of conduct.
