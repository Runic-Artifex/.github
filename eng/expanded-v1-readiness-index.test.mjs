import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { createIndex, runTwice, schema } from './expanded-v1-readiness-index.mjs';

const here = new URL('..', import.meta.url);
const load = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const zero = { requests: 0, publications: 0, signatures: 0, updates: 0, uploads: 0, releases: 0, tags: 0 };
const platforms = ['linux-x64', 'osx-arm64', 'osx-x64', 'win-x64'];
const evidenceDefinitions = [
  ['w90-desktop-conformance', 'W90', 'runic.w90-desktop-conformance-repeat/1', ['runic-desktop'], ['runic-desktop-presentation'], platforms],
  ['w100-golden-path', 'W100', 'runic.w100-golden-path-repeat/1', ['runic-assets', 'runic-desktop', 'runic-svelte', 'runic-toolkit', 'runic-toolkit-examples', 'runic-translations', 'runic-translations-editor', 'runic-vite'], ['runic-application-bridge', 'runic-assets', 'runic-desktop-presentation', 'runic-translations'], []],
  ['w105-experience-closure', 'W105', 'runic.w105-experience-closure-repeat/1', null, null, []],
  ['w110-desktop-quality', 'W110', 'runic.w110-desktop-quality-repeat/1', null, null, platforms],
];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'runic-w110-readiness-'));
  const release = load('runic.release.json'), releaseSchema = load('runic.release.schema.json');
  const compatibility = load('runic.compatibility-set.json'), compatibilitySchema = load('runic.compatibility-set.schema.json');
  const sources = new Map(compatibility.sources.map((item) => [item.repository, item]));
  const contracts = new Map(compatibility.contracts.map((item) => [item.id, item]));
  const citations = evidenceDefinitions.map(([id, milestone, receiptSchema, selectedSources, selectedContracts, selectedPlatforms]) => {
    const journey = { schema: receiptSchema, publication: 'forbidden', externalActions: zero };
    const path = `${id}.json`, absolute = join(root, path);
    const receipt = { schema: receiptSchema, journeys: [journey, structuredClone(journey)] };
    writeFileSync(absolute, JSON.stringify(receipt));
    return {
      id, milestone, schema: receiptSchema, path, sha256: hash(readFileSync(absolute)),
      sources: (selectedSources ?? [...sources.keys()].sort()).map((name) => ({ repository: name, revision: sources.get(name).revision })),
      contracts: (selectedContracts ?? [...contracts.keys()].sort()).map((id) => ({ id, sha256: contracts.get(id).sha256 })),
      platforms: selectedPlatforms,
      ...(id === 'w105-experience-closure' ? { closure: 'complete' } : {}),
    };
  });
  const evidencePath = join(root, 'evidence.json');
  const w80Path = join(root, 'w80.json');
  writeFileSync(w80Path, JSON.stringify({ schema: 'runic.local-1.0-readiness-index-repeat/1' }));
  const evidence = { schema: 'runic.expanded-v1-readiness-evidence/1', publication: 'forbidden', externalActions: zero, w80: { status: 'historical', schema: 'runic.local-1.0-readiness-index-repeat/1', path: 'w80.json', sha256: hash(readFileSync(w80Path)) }, languageProfiles: compatibility.languageProfiles, exclusions: ['unsigned', 'non-public', 'publication', 'signing', 'notarization', 'attestation-issuance', 'version-assignment', 'updates', 'automatic-operator-action', 'rust-support', 'cpp-support', 'c-webui-abi-source-work', 'hosted-topology-change'], citations };
  writeFileSync(evidencePath, JSON.stringify(evidence));
  const releasePath = join(root, 'release.json'), releaseSchemaPath = join(root, 'release.schema.json'), compatibilityPath = join(root, 'compatibility.json'), compatibilitySchemaPath = join(root, 'compatibility.schema.json');
  writeFileSync(releasePath, JSON.stringify(release)); writeFileSync(releaseSchemaPath, JSON.stringify(releaseSchema)); writeFileSync(compatibilityPath, JSON.stringify(compatibility)); writeFileSync(compatibilitySchemaPath, JSON.stringify(compatibilitySchema));
  return { root, release, releaseSchema, compatibility, compatibilitySchema, evidence, paths: { release: releasePath, compatibility: compatibilityPath, evidence: evidencePath }, cli: { releasePath, releaseSchemaPath, compatibilityPath, compatibilitySchemaPath, evidencePath } };
}

test('constructs the expanded v1 readiness index twice from isolated local evidence', () => {
  const item = fixture(), receipt = runTwice(item);
  assert.equal(receipt.schema, 'runic.expanded-v1-readiness-index-repeat/1');
  assert.deepEqual(receipt.journeys[0], receipt.journeys[1]);
  assert.equal(receipt.journeys[0].schema, schema);
  assert.equal(receipt.journeys[0].historical.w80.status, 'historical');
  assert.deepEqual(receipt.journeys[0].desktop.platforms, platforms);
  assert.deepEqual(receipt.journeys[0].externalActions, zero);
});

test('fails closed for W105, W80, language, exclusion, publication, source, and contract drift', () => {
  const changes = [
    (item) => { item.evidence.citations.find((citation) => citation.id === 'w105-experience-closure').closure = 'incomplete'; },
    (item) => { item.evidence.w80.status = 'final'; },
    (item) => { item.evidence.languageProfiles.postV1[0].state = 'supported'; },
    (item) => { item.evidence.exclusions.pop(); },
    (item) => { item.evidence.citations[0].sources[0].revision = '0'.repeat(40); },
    (item) => { item.evidence.citations[0].contracts[0].sha256 = '0'.repeat(64); },
    (item) => { const path = join(item.root, item.evidence.citations[0].path); const receipt = JSON.parse(readFileSync(path, 'utf8')); receipt.journeys[0].publication = 'published'; receipt.journeys[1].publication = 'published'; writeFileSync(path, JSON.stringify(receipt)); item.evidence.citations[0].sha256 = hash(readFileSync(path)); },
  ];
  for (const change of changes) {
    const item = fixture(); change(item);
    assert.throws(() => createIndex(item), /expanded v1 readiness index:/);
  }
});

test('rejects replayed receipt bytes and verifies a byte-identical receipt through the CLI', () => {
  const item = fixture(), receipt = runTwice(item), receiptPath = join(item.root, 'readiness.json');
  writeFileSync(receiptPath, JSON.stringify(receipt));
  const args = ['eng/expanded-v1-readiness-index.mjs', 'verify-twice', '--release', item.cli.releasePath, '--release-schema', item.cli.releaseSchemaPath, '--compatibility', item.cli.compatibilityPath, '--compatibility-schema', item.cli.compatibilitySchemaPath, '--evidence', item.cli.evidencePath, '--receipt', receiptPath];
  assert.equal(spawnSync(process.execPath, args, { cwd: here.pathname, encoding: 'utf8' }).status, 0);
  writeFileSync(join(item.root, item.evidence.citations[1].path), '{}');
  assert.throws(() => createIndex(item), /stale or replayed/);
});
