import assert from 'node:assert/strict';
import test from 'node:test';
import { runTwice, verify } from './authorized-publication-handoff.mjs';

const sha = (value) => value.repeat(64);
const source = (repository, revision, tree) => ({ repository, revision: sha(revision).slice(0, 40), tree: sha(tree).slice(0, 40) });
const editorSource = source('https://github.com/Runic-Artifex/runic-translations-editor', 'a', 'b');
const toolSource = source('https://github.com/Runic-Artifex/runic-toolkit', 'c', 'd');
const platform = (rid, value) => ({ runtimeIdentifier: rid, archive: { path: `Runic.Translations.Editor-1.2.3-${rid}.zip`, sha256: sha(value), size: 1 }, source: editorSource });
function candidateSet() { return { schema: 'runic.unsigned-candidate-set/1', publication: 'forbidden', releaseAuthority: { sha256: sha('e') }, source: editorSource, platforms: [platform('linux-x64', '1'), platform('osx-arm64', '2'), platform('win-x64', '3')] }; }
function candidateReceipt() { const journey = { schema: 'runic.unsigned-candidate-set-consumer/1', isolation: { workingDirectory: 'temporary-empty' }, noProductProjectReference: true, candidateSet: candidateSet() }; return { schema: 'runic.unsigned-candidate-set-consumer-repeat/1', journeys: [journey, structuredClone(journey)] }; }
function toolReceipt(candidate) { const journey = { schema: 'runic.unsigned-tool-staging-consumer/1', projectReferences: [], remoteSources: [], supportEnvelopeContent: 'forbidden', canonicalReleaseApproval: 'seven-package-release-gate-required', candidateSet: candidate.journeys[0].candidateSet, toolStaging: { schema: 'runic.dotnet-runic-unsigned-staging/1', publication: 'forbidden', supportEnvelopeContent: 'forbidden', source: toolSource, package: { archive: 'dotnet-runic.1.2.3.nupkg', sha256: sha('4'), metadata: { id: 'dotnet-runic' } } } }; return { schema: 'runic.unsigned-tool-staging-consumer-repeat/1', journeys: [journey, structuredClone(journey)] }; }
function artifact(key, digest, sourceFacts) { const tool = key === 'tool/dotnet-runic'; return tool ? { path: 'nuget/dotnet-runic.1.2.3.nupkg', sha256: digest, size: 0, mediaType: 'application/vnd.nuget.package', identity: 'dotnet-runic', product: 'application', version: '1.2.3', type: 'package', ecosystem: 'nuget', installKind: 'dotnet-tool' } : { path: `distribution/${key.replace('/', '-')}.zip`, sha256: digest, size: 1, mediaType: 'application/zip', identity: 'Runic.Translations.Editor', product: 'editor', version: '1.2.3', type: 'distribution', id: `translations-editor-${key.slice('editor/'.length)}`, kind: 'application-archive' };
}
function authority(candidate) {
  const entries = candidate.journeys[0].candidateSet.platforms.map((item) => ({ key: `editor/${item.runtimeIdentifier}`, candidate: { kind: 'editor-platform', runtimeIdentifier: item.runtimeIdentifier, archive: item.archive.path }, sha256: item.archive.sha256, source: item.source })).concat([{ key: 'tool/dotnet-runic', candidate: { kind: 'dotnet-tool', archive: 'dotnet-runic.1.2.3.nupkg' }, sha256: sha('4'), source: toolSource }]);
  return { schema: 'runic.authorized-publication-authority/1', publication: 'already-authorized-published', releaseAuthority: { sha256: sha('f') }, inventory: entries.map((entry, index) => { const item = artifact(entry.key, entry.sha256, entry.source); return { ...entry, artifact: item, receipt: { schemaVersion: 1, artifact: item, attestationBundle: { path: `bundles/${index}.json`, sha256: sha(String(index + 5)) }, source: entry.source, builder: { id: 'authorized-fixture-builder' }, invocation: { id: `authorized-fixture-${index}` }, materials: [{ uri: 'https://example.invalid/material', sha256: sha('9') }] } }; }) };
}

test('adapts deterministic W60 candidate receipts only through an already-published authority input', () => {
  const candidate = candidateReceipt(), tool = toolReceipt(candidate), published = authority(candidate);
  const receipt = runTwice(candidate, tool, published);
  assert.equal(receipt.journeys.length, 2); assert.deepEqual(receipt.journeys[0], receipt.journeys[1]);
  assert.deepEqual(receipt.journeys[0].transport, { outboundRequests: 0, signaturesIssued: 0, signedMetadataEmitted: 0, releaseMutations: 0, uploads: 0, tags: 0 });
});

test('rejects missing, extra, replayed, mixed, placeholder, and unassigned authority facts', () => {
  const candidate = candidateReceipt(), tool = toolReceipt(candidate);
  const cases = [
    (value) => value.inventory.pop(),
    (value) => value.inventory.push(structuredClone(value.inventory[0])),
    (value) => { value.inventory[1].key = value.inventory[0].key; },
    (value) => { value.inventory[0].source.revision = sha('0').slice(0, 40); },
    (value) => { value.inventory[0].artifact.sha256 = sha('0'); },
    (value) => { value.inventory[0].receipt.builder.id = 'REPLACE_WITH_BUILDER'; },
    (value) => { value.publication = 'unassigned'; },
  ];
  for (const change of cases) { const published = authority(candidate); change(published); assert.throws(() => verify(candidate, tool, published), /authorized publication handoff:/); }
});
