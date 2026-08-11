# First public preview launch runbook

This runbook is intentionally ordered. Stop the launch when a required check is
not complete; do not compensate by rebuilding an existing version from a newer
commit.

## 1. Freeze and record

- [x] Freeze shipping changes on every launch repository.
- [x] Record each final `main` commit and confirm there are no open release PRs.
- [x] Choose fresh, monotonically increasing candidate versions; do not reuse the
      stale private versions documented before the final source and branding work.
- [x] Record the final documentation hostname: `https://docs.runic-artifex.eu`.
- [x] Keep archived `runic-markup` out of the visibility and package train.

## 2. Produce final private candidates

The following frozen versions are the verified candidates. Toolkit, Assets, and
Flow were rebuilt after the final CS-WebUI display-branding merge; no version was
reused across different source commits.

| Product | Frozen candidate |
| --- | --- |
| Runic Command Line | `0.1.0-preview.4.1` |
| Runic Translations | `0.1.0-preview.8.1` |
| Runic Svelte | `0.1.0-preview.14.1` |
| Runic Vite | `0.1.0-preview.8.1` |
| Runic Toolkit | `0.1.0-preview.30.1` |
| Runic Assets | `0.1.0-preview.23.1` |
| Runic Flow | `0.1.0-preview.18.1` |

Local composition evidence recorded on 2026-08-10: Toolkit produced and
validated 15 NuGet packages at the planned version; Assets produced and
validated 4 packages against that local Toolkit feed; Flow produced and
validated its 2 packages; and the migrated Flow canary passed managed and
NativeAOT execution from those local package feeds. Command Line also passed its
full verification and produced its 4 planned packages. This evidence proves the
prepared graph, but does not replace private registry candidates or final-commit
workflow runs.

- [x] Publish fresh Command Line and Translations candidates.
- [x] Publish fresh Runic Svelte and Runic Vite candidates for Toolkit's template
      acceptance gate.
- [x] Update Toolkit's integration-candidate inputs, then publish a fresh Toolkit
      NuGet/npm candidate from its final commit.
- [x] Update Assets and Flow to the exact new Toolkit version.
- [x] Publish fresh Assets and headless two-package Flow candidates.
- [x] Migrate `runic-toolkit-examples` to the final Translations and two-package
      Flow candidates and pass every package-only canary.
- [x] Run every `Public release` workflow in verify-only mode with its exact final
      version and final `main` commit.
- [x] Record workflow URLs and artifact digests in the launch issue or release
      record.

Final public-artifact verification recorded on 2026-08-11. Publication was
disabled in every run.

| Product | Final `main` commit | Verify-only workflow | Artifact digest |
| --- | --- | --- | --- |
| Runic Command Line `0.1.0-preview.4.1` | `099948453ff5c0230f646a383078a1348415c196` | [Public release #9](https://github.com/Runic-Artifex/runic-command-line/actions/runs/31371955750) | `sha256:b01d22e09e1c2c8eefbf6ed781e6d93ffcfc595d879661c0edf9c6797868f135` |
| Runic Translations `0.1.0-preview.8.1` | `2dd9e264434c7076bdef2bc2b49449cd07dd009f` | [Public release #20](https://github.com/Runic-Artifex/runic-translations/actions/runs/31475867991) | `sha256:751ef1448080967c534473b6349b0cc84427e248d60bd1fba9ce31e44993dfb8` |
| Runic Svelte `0.1.0-preview.14.1` | `2af64cebad10b58da4599b67d9eaf4bffc874511` | [Public release #12](https://github.com/Runic-Artifex/runic-svelte/actions/runs/31475865977) | `sha256:19939f2cb8bc1e655365029cb69b8fe1d48fc24294a4a1dfb3b55b61d4e016a2` |
| Runic Vite `0.1.0-preview.8.1` | `a17add71a240392f8e422326f1d760f5230cc9d4` | [Public release #7](https://github.com/Runic-Artifex/runic-vite/actions/runs/31371959471) | `sha256:bb2198eb4a7144f5d8771289e027559b6c08be42483455610916989fafc1ea55` |
| Runic Toolkit `0.1.0-preview.30.1` | `092a8f913857f73789f3033005f40d3e625f58a1` | [Public release #27](https://github.com/Runic-Artifex/runic-toolkit/actions/runs/31503027950) | `sha256:f1f86dfa99ce26bcc157a117140037c7cc94f358938521e06902bc92e48d4ebb` |
| Runic Assets `0.1.0-preview.23.1` | `8920f690d412df9ce4bf2dd0a39d8e63af5bbced` | [Public release #18](https://github.com/Runic-Artifex/runic-assets/actions/runs/31503320519) | `sha256:b1abbcf6daabaca06705addb6f788bff0f42188f6cdc704bd1d006813c0593ac` |
| Runic Flow `0.1.0-preview.18.1` | `033598b65aba186c852810082716dd7df7fcd81b` | [Public release #15](https://github.com/Runic-Artifex/runic-flow/actions/runs/31503326505) | `sha256:296fbf72285bdfbde1ffd51b72bed02d87976ef903a70948876876e3eadc735a` |

Final package-consumer evidence recorded on 2026-08-11: [examples PR
#21](https://github.com/Runic-Artifex/runic-toolkit-examples/pull/21) refreshed
every branding-affected exact NuGet/npm dependency and passed the repository
gates. Those gates covered four independent package canaries, the full Linux
restore/build/test matrix, Linux NativeAOT consumers, and the Windows
real-browser/native-host roundtrip.

## 3. Correct public presentation

- [x] Confirm the portal contains the final versions and install commands.
- [x] Confirm the portal and repository descriptions use the headless Flow model.
- [x] Confirm Runic Translations consistently uses `RunicTranslations.*`,
      `runic.translations/1`, `runic-translations`, and
      `vite-plugin-runic-translations` identifiers.
- [x] Confirm the portal production build and deployment preview.

Public-presentation evidence recorded on 2026-08-11: the redeployed portal
serves the final Toolkit, Flow, Assets, Svelte, Translations, Command Line, and
Vite candidate versions; exposes the intended NuGet/npm install names; and uses
the headless Flow model. The Runic Flow GitHub description now reads “Headless
.NET runtime for typed, deterministic application processes and coordinated
operations—without a UI dependency,” consistent with the canonical brand
tagline while remaining repository-owned metadata.

## 4. Visibility and repository protection

- [x] Make `Runic-Artifex/.github` public first so organization community files and
      the shared validation action resolve for public contributors.
- [x] Make `runic-docs` and `runic-brand` public.
- [x] Make active product and integration repositories public.
- [x] Make `runic-toolkit-examples` public after its final canaries pass.
- [x] Make `runic-translations-editor` public with its first download explicitly
      marked pending.
- [x] Enable branch protection/rulesets and public-repository security features.
- [x] Add Viktor Jannicke as required reviewer to every `public-release`
      environment.

Platform audit recorded on 2026-08-11: every launch repository is public, each
has an active `safe-main` ruleset, and Dependabot security updates, secret
scanning, and push protection are enabled. All seven `public-release`
environments restrict deployment to `main` and require Viktor Jannicke's
approval. The archived `runic-markup` repository remains private and excluded.

## 5. Registry trust

- [x] Verify `NUGET_USER` in the NuGet publishing environments.
- [x] Configure NuGet trusted publishers for every owning repository,
      `public-release.yml`, and `public-release` environment.
- [x] Create `public-release` environments for `runic-svelte` and `runic-vite` with
      a `main` deployment policy.
- [x] Add one short-lived, scope-limited `NPM_BOOTSTRAP_TOKEN` to Toolkit, Svelte,
      Vite, and Translations.
- [x] Confirm all intended npm names belong to `@runic-artifex`; do not publish a
      duplicate family under `@runicartifex`.

Registry bootstrap evidence recorded on 2026-08-11:

- the existing `Runic-Artifex-CS-WebUI` NuGet policy was preserved;
- five active NuGet policies use GitHub owner `Runic-Artifex`, workflow
  `public-release.yml`, and environment `public-release` for Command Line,
  Translations, Toolkit, Assets, and Flow;
- `NUGET_USER` remains `ArtificerLabsEU` in all five publishing environments;
- the npm token is read/write only for `@runic-artifex`, bypasses 2FA, expires
  2026-08-18, and has not been used; and
- `NPM_BOOTSTRAP_TOKEN` is present only in the `public-release` environments for
  Toolkit, Svelte, Vite, and Translations.

No public-release workflow was triggered during registry setup, and no public
package was published.

## 6. Publish

- [ ] Publish Command Line and Translations, including the Translations Vite npm
      plugin.
- [ ] Publish Svelte and Vite integrations in the same launch window.
- [ ] Publish Toolkit and its Application Bridge npm package after the exact
      Svelte and Vite integrations resolve publicly.
- [ ] Install the Toolkit/Svelte/Vite combination from public registries in a
      clean application.
- [ ] Publish Assets and Flow only after their exact Toolkit dependency resolves
      publicly.
- [ ] Run public-registry canaries and wait for every package to become visible.

## 7. Remove bootstrap authority

- [ ] Configure npm trusted publishing for each newly created package record.
- [ ] Verify OIDC publication with provenance in a non-destructive follow-up
      release when appropriate.
- [ ] Delete every `NPM_BOOTSTRAP_TOKEN` secret and revoke the token at npm.
- [ ] Publish the portal and announcement only after public install commands pass.
