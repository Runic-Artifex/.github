import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createQualityJourney, repeatSchema, runTwice, verifyReceipt } from './w110-desktop-quality.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const workspace = resolve(root, '..');
const load = (name) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const input = () => ({
  releasePath: resolve(root, 'runic.release.json'),
  compatibilityPath: resolve(root, 'runic.compatibility-set.json'),
  release: load('runic.release.json'),
  releaseSchema: load('runic.release.schema.json'),
  compatibility: load('runic.compatibility-set.json'),
  compatibilitySchema: load('runic.compatibility-set.schema.json'),
  workspace,
});

test('composes exact source, contract, Linux runtime, application accessibility, scale, and memory facts without platform inflation', () => {
  const journey = createQualityJourney(input());
  assert.equal(journey.schema, 'runic.w110-desktop-quality/1');
  assert.deepEqual(journey.observedPlatforms, ['linux-x64']);
  assert.equal(journey.exclusions.windows, 'not-certified-by-this-local-evidence');
  assert.equal(journey.exclusions.macos, 'not-certified-by-this-local-evidence');
  assert.equal(journey.application.accessibility.checks.length, 3);
  assert.equal(journey.application.scale.checks.length, 3);
  assert.equal(journey.desktopRuntime.claims.multiWindow.concurrentWindowCycles, 24);
  assert.equal(journey.desktopRuntime.claims.streaming.disposal, 'required');
  assert.equal(journey.desktopRuntime.claims.reconnect.authenticatedConnections, 2);
  assert.equal(journey.desktopRuntime.claims.cleanRecovery.embeddedWebViewRestart, 'second-surface-window');
  assert.equal(journey.application.evidenceFiles.length, 9);
  assert(journey.sources.every((source) => /^[a-f0-9]{40}$/.test(source.revision) && /^[a-f0-9]{40}$/.test(source.tree)));
  assert(journey.contracts.every((contract) => /^[a-f0-9]{64}$/.test(contract.sha256)));
});

test('is deterministic and fails closed for altered native/runtime, application, authority, and platform claims', () => {
  const item = input();
  const receipt = runTwice(item, { verifyChecks: false });
  assert.equal(receipt.schema, repeatSchema);
  assert.deepEqual(receipt.journeys[0], receipt.journeys[1]);
  verifyReceipt(item, receipt, { verifyChecks: false });
  const mutations = [
    (value) => { value.journeys[1].desktopRuntime.claims.streaming.disposal = 'optional'; },
    (value) => { value.journeys[1].application.scale.checks[2].facts[1] = 'unbounded heap'; },
    (value) => { value.journeys[1].authority.compatibility.sha256 = '0'.repeat(64); },
    (value) => { value.journeys[1].observedPlatforms.push('win-x64'); },
    (value) => { value.journeys[1].sources[0].tree = '0'.repeat(40); },
    (value) => { value.journeys[1].desktopRuntime.source.sha256 = '0'.repeat(64); },
  ];
  for (const mutate of mutations) {
    const altered = structuredClone(receipt);
    mutate(altered);
    assert.throws(() => verifyReceipt(item, altered, { verifyChecks: false }), /W110 Desktop quality:/);
  }
});

test('native receipt citation is content-addressed at the pinned Desktop source revision', () => {
  const journey = createQualityJourney(input());
  const expected = createHash('sha256').update(readFileSync(resolve(workspace, 'runic-desktop/evidence/native-quality/linux-x64.json'))).digest('hex');
  assert.equal(journey.desktopRuntime.source.sha256, expected);
});

test('the retained local-only W110 quality receipt exactly verifies against current authority', () => {
  const receipt = JSON.parse(readFileSync(resolve(root, 'evidence/w110-desktop-quality.json'), 'utf8'));
  verifyReceipt(input(), receipt, { verifyChecks: false });
});
