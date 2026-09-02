import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { verifyCompatibilitySet, verifyWorkspace } from "./verify-compatibility-set.mjs";

const load = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));
const candidate = load("runic.compatibility-set.json");
const schema = load("runic.compatibility-set.schema.json");
const release = load("runic.release.json");
const errorsFor = (change) => { const value = structuredClone(candidate); change(value); return verifyCompatibilitySet(value, schema, release).join("\n"); };

test("canonical compatibility set is complete and locally reproducible", () => {
  assert.deepEqual(verifyCompatibilitySet(candidate, schema, release), []);
  assert.deepEqual(verifyWorkspace(candidate, new URL("../..", import.meta.url).pathname), []);
});

test("package skew and non-monotonic candidate labels fail closed", () => {
  assert.match(errorsFor((value) => { value.packages[0].version = "1.0.0-preview.deadbee"; }), /ordered preview version|hash-shaped/);
  assert.match(errorsFor((value) => { value.releaseTrainVersion = "1.0.0-deadbeef"; }), /ordered preview version|hash-shaped/);
  assert.match(errorsFor((value) => { value.packages.pop(); }), /missing canonical package/);
  assert.match(errorsFor((value) => { value.packages[1].identity = value.packages[0].identity; }), /duplicate/);
});

test("product package versions are exact without requiring lockstep versioning", () => {
  const value = structuredClone(candidate);
  value.packages[0].version = "1.0.0-preview.2";
  assert.deepEqual(verifyCompatibilitySet(value, schema, release), []);
});

test("toolchain, source, contract, and platform drift fail closed", () => {
  assert.match(errorsFor((value) => { value.toolchain.node = "24.x"; }), /exact numeric version/);
  assert.match(errorsFor((value) => { value.toolchain.bun = "1.x"; }), /exact numeric version/);
  assert.match(errorsFor((value) => { value.platformProfiles.pop(); }), /four certified desktop profiles/);
  assert.match(errorsFor((value) => { value.sources[0].revision = "main"; }), /full Git revision/);
  assert.match(errorsFor((value) => { value.contracts[0].sha256 = "0"; }), /invalid digest/);
  assert.match(errorsFor((value) => { value.languageProfiles.postV1[0].state = "supported"; }), /leaving Rust and C\+\+ unassigned/);
});
