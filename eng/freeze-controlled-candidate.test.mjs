import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { freeze, runTwice } from './freeze-controlled-candidate.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const names = [['w30-rollout','runic.current-hosted-rollout-repeat/1'],['w40-localization','runic.w40-localization-compatibility-repeat/1'],['w50-support','runic.support-envelope-consumer-repeat/1'],['w50-recovery','runic.recovery-capability-consumer-repeat/1'],['w50-quality','runic.editor-structural-quality-repeat/1'],['w60-candidate','runic.unsigned-candidate-set-consumer-repeat/1'],['w60-tool','runic.unsigned-tool-staging-consumer-repeat/1'],['w60-preflight','runic.manual-replacement-preflight-consumer-repeat/1'],['w60-handoff','runic.authorized-publication-handoff-repeat/1']];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'runic-w70-freeze-')); const paths = {};
  const source = { repository: 'https://example.invalid/repository', revision: 'a'.repeat(40), tree: 'b'.repeat(40) };
  const authority = { revision: 'c'.repeat(40), tree: 'd'.repeat(40), sha256: sha('authority') };
  const artifacts = [['linux-x64', sha('linux')], ['osx-arm64', sha('osx')], ['win-x64', sha('win')]].map(([runtimeIdentifier, sha256]) => ({ runtimeIdentifier, sha256 }));
  const journeys = {
    'w30-rollout': { releaseAuthority: { revision: authority.revision, tree: authority.tree, digest: authority.sha256 } },
    'w40-localization': { inputs: { desktop: { sha256: sha('localized-desktop') } } },
    'w50-support': { tool: { sha256: sha('support-tool') } },
    'w50-recovery': { diagnostics: { schema: 'runic.translations.editor-diagnostics/1' } },
    'w50-quality': { localProfiles: { toolkit: source } },
    'w60-candidate': { candidateSet: { source, platforms: artifacts.map((artifact) => ({ runtimeIdentifier: artifact.runtimeIdentifier, archive: { sha256: artifact.sha256 }, source })) } },
    'w60-tool': { toolStaging: { source } },
    'w60-preflight': { provenance: { candidateReceipt: {}, authority: { sha256: authority.sha256 } } },
    'w60-handoff': { receipts: [{ artifact: { identity: 'dotnet-runic' }, source }], transport: { outboundRequests: 0, signaturesIssued: 0, signedMetadataEmitted: 0, releaseMutations: 0, uploads: 0, tags: 0 } },
  };
  for (const [id, schema] of names) { const value = { schema, journeys: [journeys[id], structuredClone(journeys[id])] }; const path = join(root, `${id}.json`); writeFileSync(path, JSON.stringify(value)); paths[id] = path; }
  journeys['w60-preflight'].provenance.candidateReceipt.sha256 = sha(readFileSync(paths['w60-candidate']));
  writeFileSync(paths['w60-preflight'], JSON.stringify({ schema: names.find(([id]) => id === 'w60-preflight')[1], journeys: [journeys['w60-preflight'], structuredClone(journeys['w60-preflight'])] }));
  const profiles = { 'w30-rollout': 'd008-hosted-product', 'w40-localization': 'editor-desktop', 'w50-support': 'csharp-host', 'w50-recovery': 'csharp-host', 'w50-quality': 'local-application-bridge', 'w60-candidate': 'editor-desktop', 'w60-tool': 'csharp-host', 'w60-preflight': 'editor-desktop', 'w60-handoff': 'csharp-host' };
  const facts = {
    'w30-rollout': [{ revision: authority.revision, tree: authority.tree }],
    'w40-localization': [{ sha256: journeys['w40-localization'].inputs.desktop.sha256 }],
    'w50-support': [{ sha256: journeys['w50-support'].tool.sha256 }],
    'w50-recovery': [{ diagnostics: journeys['w50-recovery'].diagnostics }],
    'w50-quality': [{ revision: source.revision, tree: source.tree }],
    'w60-candidate': [{ revision: source.revision, tree: source.tree }],
    'w60-tool': [{ revision: source.revision, tree: source.tree }],
    'w60-preflight': [{ sha256: journeys['w60-preflight'].provenance.candidateReceipt.sha256 }],
    'w60-handoff': [{ transport: journeys['w60-handoff'].transport }],
  };
  const citations = names.map(([id, schema]) => ({ id, profile: profiles[id], schema, sha256: sha(readFileSync(paths[id])), facts: facts[id] }));
  return { paths, input: { schema: 'runic.controlled-nonpublic-profile-input/1', publication: 'forbidden', profiles: { 'csharp-host': { source }, 'local-application-bridge': { source }, 'editor-desktop': { source, artifacts }, 'd008-hosted-product': { authority } }, citations } };
}
test('freezes exactly four non-public profiles deterministically', () => { const item = fixture(), receipt = runTwice(item.input, item.paths); assert.deepEqual(receipt.journeys[0], receipt.journeys[1]); assert.equal(receipt.journeys[0].publication, 'forbidden'); assert.equal(receipt.journeys[0].externalActions.requests, 0); });
test('rejects missing, duplicate, stale, mixed, and cross-profile citations', () => { const changes = [(item) => item.input.citations.pop(), (item) => item.input.citations.push(structuredClone(item.input.citations[0])), (item) => { item.input.citations[0].sha256 = sha('stale'); }, (item) => { item.input.citations[0].facts = [{ source: 'mixed' }]; }, (item) => { item.input.citations[0].profile = 'not-a-profile'; }]; for (const change of changes) { const item = fixture(); change(item); assert.throws(() => freeze(item.input, item.paths), /controlled candidate freeze:/); } });
test('rejects profile facts forged while their citations remain intact', () => {
  const changes = [
    (item) => { item.input.profiles['csharp-host'].source.revision = 'e'.repeat(40); },
    (item) => { item.input.profiles['editor-desktop'].artifacts[0].sha256 = sha('forged-editor-archive'); },
    (item) => { item.input.profiles['d008-hosted-product'].authority.sha256 = sha('forged-authority'); },
  ];
  for (const change of changes) { const item = fixture(); change(item); assert.throws(() => freeze(item.input, item.paths), /controlled candidate freeze:/); }
});
