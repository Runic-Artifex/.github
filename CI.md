# CI policy record

[`runic.ci.json`](runic.ci.json) and its
[schema](runic.ci.schema.json) preserve the organization CI policy: pinned
tool versions, package-registry endpoints, dependency-stage ordering, and
candidate-retention settings. `eng/verify-ci-policy.mjs` validates the policy,
and its test covers the retention-plan behavior.

The policy currently records five dependency stages and leaves automatic
candidate deletion disabled. It is useful when inspecting historical
organization coordination; it does not replace a product repository's CI or
release workflow.

Current build, test, and publishing requirements are owned by each product
repository. The reusable local component in this repository is the
[release-artifact validation action](.github/actions/validate-release-artifacts).
