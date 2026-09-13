# Release authority and records

This repository preserves the organization-level release record. It is not the
current release procedure for a product.

[`runic.release.json`](runic.release.json) and its
[schema](runic.release.schema.json) record product identities, compatibility
lanes, artifact ownership, and supported formats. The related
[`runic.compatibility-set.json`](runic.compatibility-set.json) is a retained
composition record, and the `evidence/` directory retains the evidence cited by
that record.

The `eng/verify-release-manifest.mjs` and
`eng/verify-compatibility-set.mjs` tools validate those documents against their
committed schemas. Treat a successful validation as confirmation that the
record is internally consistent, not as a publication decision.

For a current release, follow the owning product repository's release policy,
workflow, package inventory, and registry controls:
[Runic SDK](https://github.com/Runic-Artifex/runic-sdk/blob/main/eng/release/README.md),
[Runic CLI SDK](https://github.com/Runic-Artifex/runic-cli-sdk/blob/main/eng/release/README.md)
and [Runic Translations SDK](https://github.com/Runic-Artifex/runic-translations-sdk/blob/main/eng/release/README.md).
