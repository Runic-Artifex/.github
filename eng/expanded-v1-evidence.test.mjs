import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { materialize, zeroActions } from './expanded-v1-evidence.mjs';

const repeat = (schema, journey) => ({ schema, journeys: [journey, structuredClone(journey)] });
const json = (path, value) => writeFileSync(path, JSON.stringify(value));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'runic-expanded-evidence-')), outputDir = join(root, 'out');
  const compatibilityPath = join(root, 'compatibility.json'), w80Path = join(root, 'w80.json'), w90Path = join(root, 'w90.json'), w100FirstPath = join(root, 'w100-a.json'), w100SecondPath = join(root, 'w100-b.json'), w105CleanPath = join(root, 'w105-clean.json'), w105LocalizedPath = join(root, 'w105-localized.json'), w110Path = join(root, 'w110.json');
  const sourceNames = ['runic-assets', 'runic-command-line', 'runic-desktop', 'runic-svelte', 'runic-toolkit', 'runic-toolkit-examples', 'runic-translations', 'runic-translations-editor', 'runic-vite'];
  const contractNames = ['runic-application-bridge', 'runic-assets', 'runic-desktop-presentation', 'runic-translations'];
  json(compatibilityPath, { publication: 'forbidden', languageProfiles: { v1: [], postV1: [] }, sources: sourceNames.map((repository, index) => ({ repository, revision: String(index).padStart(40, 'a') })), contracts: contractNames.map((id, index) => ({ id, sha256: String(index).padStart(64, 'b') })) });
  json(w80Path, repeat('runic.local-1.0-readiness-index-repeat/1', { publication: 'forbidden', externalActions: zeroActions }));
  json(w90Path, { format: 'runic.desktop.conformance-receipt/1', results: [{ outcome: 'pass' }] });
  const w100 = { schema: 'runic.desktop.w100-golden-path/1', validation: { journeys: ['passed'] } }; json(w100FirstPath, w100); json(w100SecondPath, w100);
  json(w105CleanPath, repeat('runic.current-clean-install-repeat/3', { phases: [{ status: 'passed', exitCode: 0 }] }));
  json(w105LocalizedPath, repeat('runic.localized-desktop-product-repeat/1', { phases: [{ status: 'passed', exitCode: 0 }] }));
  json(w110Path, repeat('runic.w110-desktop-quality-repeat/1', { publication: 'forbidden', externalActions: zeroActions, observedPlatforms: ['linux-x64', 'osx-arm64', 'osx-x64', 'win-x64'] }));
  return { root, outputDir, compatibilityPath, w80Path, w90Path, w100FirstPath, w100SecondPath, w105CleanPath, w105LocalizedPath, w110Path };
}

test('materializes deterministic wrappers around retained milestone evidence', () => {
  const first = fixture(), second = fixture();
  const one = materialize(first), two = materialize(second);
  assert.deepEqual(one, two);
  assert.equal(one.citations.length, 4);
  assert.deepEqual(one.citations.find((item) => item.id === 'w110-desktop-quality').platforms, ['linux-x64', 'osx-arm64', 'osx-x64', 'win-x64']);
  assert.equal(JSON.parse(readFileSync(join(first.outputDir, 'w105-experience-closure.json'))).journeys[0].closure, 'complete');
});

test('rejects non-identical W100 evidence and incomplete phases', () => {
  const first = fixture();
  json(first.w100SecondPath, { schema: 'runic.desktop.w100-golden-path/1', validation: { journeys: [] } });
  assert.throws(() => materialize(first), /byte-identical complete/);
  const second = fixture();
  json(second.w105CleanPath, repeat('runic.current-clean-install-repeat/3', { phases: [{ status: 'failed', exitCode: 1 }] }));
  assert.throws(() => materialize(second), /phases are incomplete/);
});
