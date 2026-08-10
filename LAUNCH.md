# First public preview launch runbook

This runbook is intentionally ordered. Stop the launch when a required check is
not complete; do not compensate by rebuilding an existing version from a newer
commit.

## 1. Freeze and record

- [ ] Freeze shipping changes on every launch repository.
- [ ] Record each final `main` commit and confirm there are no open release PRs.
- [ ] Choose fresh, monotonically increasing candidate versions; do not reuse the
      stale private versions documented before the final source and branding work.
- [ ] Record the final documentation hostname: `____________________________`.
- [ ] Keep archived `runic-markup` out of the visibility and package train.

## 2. Produce final private candidates

The next workflow run numbers currently imply the following planned versions.
They are coordination targets, not verified candidates, until their private
publication and canaries succeed.

| Product | Planned candidate |
| --- | --- |
| Runic Command Line | `0.1.0-preview.4.1` |
| Runic Translations | `0.1.0-preview.4.1` |
| Runic Svelte | `0.1.0-preview.8.1` |
| Runic Vite | `0.1.0-preview.8.1` |
| Runic Toolkit | `0.1.0-preview.22.1` |
| Runic Assets | `0.1.0-preview.17.1` |
| Runic Flow | `0.1.0-preview.5.1` |

Local composition evidence recorded on 2026-08-10: Toolkit produced and
validated 15 NuGet packages at the planned version; Assets produced and
validated 4 packages against that local Toolkit feed; Flow produced and
validated its 2 packages; and the migrated Flow canary passed managed and
NativeAOT execution from those local package feeds. Command Line also passed its
full verification and produced its 4 planned packages. This evidence proves the
prepared graph, but does not replace private registry candidates or final-commit
workflow runs.

- [ ] Publish fresh Command Line and Translations candidates.
- [ ] Publish fresh Runic Svelte and Runic Vite candidates for Toolkit's template
      acceptance gate.
- [ ] Update Toolkit's integration-candidate inputs, then publish a fresh Toolkit
      NuGet/npm candidate from its final commit.
- [ ] Update Assets and Flow to the exact new Toolkit version.
- [ ] Publish fresh Assets and headless two-package Flow candidates.
- [ ] Migrate `runic-toolkit-examples` to the final Translations and two-package
      Flow candidates and pass every package-only canary.
- [ ] Run every `Public release` workflow in verify-only mode with its exact final
      version and final `main` commit.
- [ ] Record workflow URLs and artifact digests in the launch issue or release
      record.

## 3. Correct public presentation

- [ ] Confirm the portal contains the final versions and install commands.
- [ ] Confirm the portal and repository descriptions use the headless Flow model.
- [ ] Confirm Runic Translations consistently uses `RunicTranslations.*`,
      `runic.translations/1`, `runic-translations`, and
      `vite-plugin-runic-translations` identifiers.
- [ ] Confirm the portal production build and deployment preview.

## 4. Visibility and repository protection

- [ ] Make `Runic-Artifex/.github` public first so organization community files and
      the shared validation action resolve for public contributors.
- [ ] Make `runic-docs` and `runic-brand` public.
- [ ] Make active product and integration repositories public.
- [ ] Make `runic-toolkit-examples` public after its final canaries pass.
- [ ] Make `runic-translations-editor` public with its first download explicitly
      marked pending.
- [ ] Enable branch protection/rulesets and public-repository security features.
- [ ] Add Viktor Jannicke as required reviewer to every `public-release`
      environment.

## 5. Registry trust

- [ ] Verify `NUGET_USER` in the NuGet publishing environments.
- [ ] Configure NuGet trusted publishers for every owning repository,
      `public-release.yml`, and `public-release` environment.
- [ ] Create `public-release` environments for `runic-svelte` and `runic-vite` with
      a `main` deployment policy.
- [ ] Add one short-lived, scope-limited `NPM_BOOTSTRAP_TOKEN` to Toolkit, Svelte,
      Vite, and Translations.
- [ ] Confirm all intended npm names belong to `@runic-artifex`; do not publish a
      duplicate family under `@runicartifex`.

## 6. Publish

- [ ] Publish Command Line and Translations, including the Translations Vite npm
      plugin.
- [ ] Publish Toolkit and its Application Bridge npm package.
- [ ] Publish Svelte and Vite integrations in the same launch window.
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
