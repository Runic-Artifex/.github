# Runic Artifex release policy

[`runic.release.json`](runic.release.json), validated by the committed schema
and verifier, is the sole release-train authority for product identity, package
disposition, compatibility lanes, artifact ownership, and format support. This
policy is not a second package inventory.

## Historical v0.2 breaking changes and migration

The v0.2 work was an intentional breaking migration. Its retired identities are
no longer current release authority; retained historical documentation and Git
history provide the migration record. Before a release is approved, any
accepted breaking command, configuration, diagnostic, generated API, serialized
format, or wire-contract change must provide actionable migration guidance. The
owning product supplies diagnostics and, where safe, analyzers, code fixes, or
migration tooling.

Renamed, merged, internalized, and retired preview NuGet identities receive one
final deprecation release with the manifest's migration destination, then stop
evolving. There are no permanent forwarding packages, compatibility facades,
namespace aliases, or second package identities. npm identities remain only when
the manifest explicitly says `keep`.

Serialized formats and wire contracts are independent commitments: writers state
their format version, readers state supported versions, and a breaking writer
provides a reader or migration path for retained data and supported peers. A
package rename never waives a wire contract obligation.

## Compatibility lanes and release candidates

The `v1.0` train has current, previous-supported, and next-candidate lanes.
Publication versions remain unassigned until verified from registry evidence;
roadmap targets never infer a published version. Runic Flow remains an archived
historical product outside the train. The accepted archive decision is the
immutable pointer in the release authority to `runic-flow` ADR 0002.

### Flow archive prerequisite

Before the v1.0 launch candidate, complete the separate historical Flow archive operation:
publish exactly one final deprecation release for `RunicFlow` and
`RunicFlow.ApplicationBridge`, set each NuGet registry deprecation and migration
link to the archive guidance, and retain the resulting upstream receipt and
attestation evidence. This is not a v1.0 package candidate, does not add either
identity to `canonicalPackages` or a compatibility lane, and does not create an
Operations replacement or forwarding alias.

At release candidate freeze, the exact commit, package metadata, artifact set,
provenance, compatibility set, documentation, and migration guides freeze
together. An exception needs an owner, impact and compatibility review, a new
candidate version from a new commit, full rebuild of affected artifacts,
package-only canaries, and every release gate repeated. A stale candidate is
never rebuilt from a different commit under the same version.

`runic.compatibility-set.json` is the pre-1.0 composition authority. It pins the
ordered candidate version, every canonical NuGet and npm identity, source
revisions, contract fingerprints, toolchain, and certified platform profiles.
It is explicitly publication-forbidden: selecting or verifying the set never
constitutes release approval. Consumers must fail when exact pins disagree and
must stage candidates in process-local temporary feeds rather than modifying
user-level NuGet or npm configuration.

### Expanded v1 readiness index

`eng/expanded-v1-readiness-index.mjs` is the local-only W110 decision input. It
does not replace the historical W80 receipt: it retains W80 only as a hashed
historical reference while requiring four new deterministic, zero-action
receipts for W90 conformance, W100 golden-path integration, W105 experience
closure, and W110 Desktop quality. Each citation binds its receipt hash to the
exact current compatibility sources, contract fingerprints, and—where
applicable—the certified platform profile. The evidence input must leave Rust
and C++ unassigned, keep the declared exclusions exact, and mark W105 complete.

`eng/expanded-v1-evidence.mjs` verifies the retained milestone inputs and
materializes deterministic wrapper receipts plus the exact evidence manifest.
The committed inputs can be replayed without network access:

```sh
node eng/expanded-v1-evidence.mjs materialize \
  --compatibility runic.compatibility-set.json \
  --w80 evidence/expanded-v1/inputs/w80-readiness.json \
  --w90 evidence/expanded-v1/inputs/w90-desktop-conformance.json \
  --w100-first evidence/expanded-v1/inputs/w100-golden-path-first.json \
  --w100-second evidence/expanded-v1/inputs/w100-golden-path-second.json \
  --w105-clean evidence/expanded-v1/inputs/w105-clean-install.json \
  --w105-localized evidence/expanded-v1/inputs/w105-localized-desktop.json \
  --w110 evidence/w110-desktop-quality.json \
  --output-dir evidence/expanded-v1
node eng/expanded-v1-readiness-index.mjs run-twice \
  --release runic.release.json --release-schema runic.release.schema.json \
  --compatibility runic.compatibility-set.json \
  --compatibility-schema runic.compatibility-set.schema.json \
  --evidence evidence/expanded-v1/evidence.json \
  --workspace .. > evidence/expanded-v1/readiness.json
node eng/expanded-v1-readiness-index.mjs verify-twice \
  --release runic.release.json --release-schema runic.release.schema.json \
  --compatibility runic.compatibility-set.json \
  --compatibility-schema runic.compatibility-set.schema.json \
  --evidence evidence/expanded-v1/evidence.json \
  --workspace .. --receipt evidence/expanded-v1/readiness.json
```

The verifier rejects missing or replayed receipts, authority/source/contract
drift, a W80-only claim, incomplete W105 closure, undeclared language or
platform support, softened exclusions, and any publication-bearing input.

### W110 Desktop quality citation

`eng/w110-desktop-quality.mjs` composes the local, retained Linux native
receipt, the hosted Windows/macOS native certification, and the Translation
Editor's application accessibility, 10,000/50,000 message scale, and
50,000-message heap-budget checks. It requires a clean workspace at the exact
compatibility revisions and runs each Editor check twice before writing an
exact two-run receipt. It binds every compatibility source, contract
fingerprint, release authority digest, and platform-selection fact.

`eng/w110-native-certification.mjs` independently replays Desktop's exact raw
stress-matrix verifier, checks the immutable hosted job graph and every required
native phase, and requires a complete passing TRX corpus for `win-x64`,
`osx-x64`, and `osx-arm64`. The evidence remains raw observation rather than a
calibrated performance SLA; native assistive-technology and profiler-backed
memory claims stay excluded. The retained local-only citations are
`evidence/w110-native-certification.json` and
`evidence/w110-desktop-quality.json`.

```sh
node eng/w110-desktop-quality.mjs run-twice \
  --release runic.release.json --release-schema runic.release.schema.json \
  --compatibility runic.compatibility-set.json \
  --compatibility-schema runic.compatibility-set.schema.json \
  --workspace .. \
  --native-certification evidence/w110-native-certification.json \
  --native-evidence-root evidence/native-certification/33621048164 \
  --native-matrix evidence/native-certification/33621048164/matrix.json \
  --native-run evidence/native-certification/33621048164/run.json \
  > ./expanded-v1-evidence/w110-desktop-quality.json
node eng/w110-desktop-quality.mjs verify-twice \
  --release runic.release.json --release-schema runic.release.schema.json \
  --compatibility runic.compatibility-set.json \
  --compatibility-schema runic.compatibility-set.schema.json \
  --workspace .. \
  --native-certification evidence/w110-native-certification.json \
  --native-evidence-root evidence/native-certification/33621048164 \
  --native-matrix evidence/native-certification/33621048164/matrix.json \
  --native-run evidence/native-certification/33621048164/run.json \
  --receipt ./expanded-v1-evidence/w110-desktop-quality.json
```

## Required evidence and publication

Before public release approval, restore the final `main` commit in a clean
checkout; produce the exact NuGet and npm artifact set; verify metadata,
provenance, version, isolated-cache consumption, applicable NativeAOT and
frontend production gates, and unchanged source; record artifact digests; run
the verify-only public-release dispatch; and prove exact-version downstream
canaries. Green source CI alone is not release-candidate evidence.

### Attestation-backed release evidence

`eng/release-evidence.mjs` is the Phase 5, non-publishing evidence step. It
derives the package inventory from `canonicalPackages` and distributions from
`distributions` in `runic.release.json`; no second package list is accepted.
It performs GitHub attestation verification entirely from a local, receipt-bound
GitHub attestation bundle with the pinned GitHub CLI; no GitHub API fallback is
permitted. For a release
authority with explicit, published current-lane values and staged
artifacts, collect one upstream build receipt for each artifact, then run:

```sh
node eng/release-evidence.mjs \
  --manifest runic.release.json --schema runic.release.schema.json \
  --artifacts ./release-artifacts --receipts ./upstream-receipts \
  --attestation-bundles ./github-attestation-bundles \
  --out ./release-evidence --lane current --created 2026-08-20T00:00:00Z
node eng/release-evidence.mjs \
  --manifest runic.release.json --schema runic.release.schema.json \
  --artifacts ./release-artifacts --receipts ./upstream-receipts \
  --attestation-bundles ./github-attestation-bundles \
  --out ./release-evidence --lane current --created 2026-08-20T00:00:00Z --check
```

The staged paths are deterministic: `nuget/<identity>.<version>.nupkg`,
`npm/<scope-name>-<version>.tgz`, and
`distribution/<identity>-<version>.zip`. The tool requires one valid upstream
receipt per artifact. A receipt binds its artifact's SHA-256, size,
media type, canonical identity/version, source repository/revision/tree,
builder, invocation, and tool/config materials. The collector rejects
unassigned versions, missing or extra files or receipts, duplicate paths,
symlinks, traversal, mismatched npm/NuGet embedded metadata, invalid ZIP
distributions, changed input trees, and altered or non-closed evidence output.
It writes a canonical inventory, a valid SPDX 2.3 SBOM with conservative
`NOASSERTION` license conclusions (raw package license metadata is not treated
as a validated SPDX expression), and an in-toto collection statement that references
the upstream receipts. That statement is collection evidence, not a claim that
this collector built the artifacts. `--check` regenerates and byte-verifies it.

The collector deliberately records only deterministic inventory, SBOM, and
provenance evidence. Signing, notarization, signed update metadata, registry
upload, and update-manifest publication are not part of the 1.0 staging path.

### Unsigned local candidate sets

`eng/link-unsigned-candidate-set.mjs` links an already closed three-platform
Editor staging set to the **unassigned** `translations-editor-archive`
distribution. Its receipt is explicitly `publication: "forbidden"`, binds the
authority digest and every platform archive/staging record, and accepts only
placeholder attestation fields. It is not accepted by the published-only
collector and has no upload, tag, release, signing, or update behavior.

Product support-envelope and native-capability evidence may be cited only by
their product-owned receipt hash; their payloads are not distribution inputs.

New package families use their owning repository's `public-release.yml` with
trusted publishing bound to repository, workflow, and environment. Long-lived
write tokens are not the steady-state mechanism. The first npm publication may
use a narrowly scoped bootstrap token only to establish the package record; it
must then be removed in favor of OIDC provenance.

The documentation portal is the public source of truth. It must match the final
artifacts, migration guides, compatibility data, package names, and publication
state, and must not claim pending candidates are complete.
