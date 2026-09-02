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

### Historical Flow archive prerequisite

- [ ] Before v1.0 candidates, publish exactly the final deprecated
      `RunicFlow` and `RunicFlow.ApplicationBridge` archive packages.
- [ ] Set NuGet deprecation and migration links for both packages to the Flow
      archive guidance, then retain the upstream receipt and attestation
      evidence.
- [ ] Keep this archive operation outside the v1.0 candidate inventory,
      compatibility lanes, and package-only canaries; do not publish an
      Operations replacement or forwarding alias.

The publication-forbidden compatibility set currently selects the following
ordered local train. These are coordination inputs, not published versions or
release authorization.

| Product | Planned candidate |
| --- | --- |
| Runic Application | `1.0.0-preview.1` |
| Runic Desktop | `1.0.0-preview.1` |
| Runic Command Line | `1.0.0-preview.1` |
| Runic Assets | `1.0.0-preview.1` |
| Runic Translations | `1.0.0-preview.1` |
| Runic Svelte | `1.0.0-preview.1` |
| Runic Vite | `1.0.0-preview.1` |
| Runic Translations Editor | `1.0.0-preview.1` |

Local verification proves source and isolated candidate composition only. It
does not replace registry candidates or final-commit workflow runs. Runic Flow
is archived and is not a launch candidate; standalone CS-WEBUI remains an
independent upstream-compatibility product and is not part of the Runic v1 train.

- [ ] Publish fresh Command Line and Translations candidates.
- [ ] Publish fresh Runic Desktop, Svelte, and Vite candidates for Application's template
      acceptance gate.
- [ ] Update Application's integration-candidate inputs, then publish a fresh Application
      NuGet/npm candidate from its final commit.
- [ ] Update Assets and the Translations Editor to the exact compatibility set.
- [ ] Publish fresh Assets candidates.
- [ ] Migrate `runic-toolkit-examples` to the final Translations candidates and
      pass every package-only canary.
- [ ] Run every `Public release` workflow in verify-only mode with its exact final
      version and final `main` commit.
- [ ] Record workflow URLs and artifact digests in the launch issue or release
      record.

## 3. Correct public presentation

- [ ] Confirm the portal contains the final versions and install commands.
- [ ] Generate fresh React, Vue, Svelte, and Angular applications; prove the npm,
      pnpm, and Bun selections with their committed lock files and frozen installs.
- [ ] Confirm the generated quick start restores the local `dotnet-runic` manifest,
      `doctor` identifies the selected package manager, and both Vite and Angular
      development commands run through the standard `dev` script.
- [ ] Confirm published applications contain their static frontend assets and the
      target-machine guidance does not require Node.js, Bun, npm, pnpm, Vite, or
      Angular CLI.
- [ ] Confirm the portal describes archived Flow only through its canonical
      release-authority archive decision and migration link.
- [ ] Confirm Runic Translations consistently uses `Runic.Translations.*`,
      `runic.translations/1`, `runic-translations`, and
      `vite-plugin-runic-translations` identifiers.
- [ ] Confirm Runic Desktop is presented as the suite presentation host and is
      clearly distinguished from independent standalone CS-WEBUI.
- [ ] Fail the launch if current pages still contain `<VERSION>`, "first package
      pending", "W110 pending", or another placeholder/stale readiness claim;
      retained historical evidence must be labeled as historical.
- [ ] Refresh the W110 readiness receipt against the final source revisions and
      compatibility-set digest after the package-manager DX changes.
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
- [ ] Publish Runic Application and its Application Bridge npm package.
- [ ] Publish Desktop, Svelte, and Vite integrations in the same launch window.
- [ ] Install the Application/Desktop/Svelte/Vite combination from public registries in a
      clean application.
- [ ] Publish Assets only after its exact Toolkit dependency resolves publicly.
- [ ] Run public-registry canaries and wait for every package to become visible.

## 7. Remove bootstrap authority

- [ ] Configure npm trusted publishing for each newly created package record.
- [ ] Verify OIDC publication with provenance in a non-destructive follow-up
      release when appropriate.
- [ ] Delete every `NPM_BOOTSTRAP_TOKEN` secret and revoke the token at npm.
- [ ] Publish the portal and announcement only after public install commands pass.
