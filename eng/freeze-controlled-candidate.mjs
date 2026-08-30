#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const schema = 'runic.controlled-nonpublic-profile-freeze/1';
export const repeatSchema = 'runic.controlled-nonpublic-profile-freeze-repeat/1';
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const fail = (message) => { throw new Error(`controlled candidate freeze: ${message}`); };
const read = (path, label) => { try { return JSON.parse(readFileSync(resolve(path), 'utf8')); } catch { fail(`${label} must be valid JSON`); } };
const matches = (value, wanted) => wanted && typeof wanted === 'object' && !Array.isArray(wanted) ? value && typeof value === 'object' && !Array.isArray(value) && Object.entries(wanted).every(([key, item]) => matches(value[key], item)) : same(value, wanted);
const contains = (value, wanted) => matches(value, wanted) || (Array.isArray(value) ? value.some((item) => contains(item, wanted)) : value && typeof value === 'object' && Object.values(value).some((item) => contains(item, wanted)));
const citationProfiles = { 'w30-rollout': 'd008-hosted-product', 'w40-localization': 'editor-desktop', 'w50-support': 'csharp-host', 'w50-recovery': 'csharp-host', 'w50-quality': 'local-application-bridge', 'w60-candidate': 'editor-desktop', 'w60-tool': 'csharp-host', 'w60-preflight': 'editor-desktop', 'w60-handoff': 'csharp-host' };
const sourceKeys = ['repository', 'revision', 'tree'];
const editorRids = ['linux-x64', 'osx-arm64', 'win-x64'];

function repeated(value, expected) {
  if (value?.schema !== expected || !Array.isArray(value.journeys) || value.journeys.length !== 2 || !same(value.journeys[0], value.journeys[1])) fail(`citation is not a deterministic ${expected} receipt`);
  return value.journeys[0];
}

function validSource(source) {
  return source && typeof source === 'object' && sourceKeys.every((key) => /^[a-f0-9]{40}$/.test(source[key] ?? '') || key === 'repository' && typeof source[key] === 'string' && source[key].startsWith('https://'));
}

function sourceMatches(actual, expected) {
  return validSource(expected) && actual && /^[a-f0-9]{40}$/.test(actual.revision ?? '') && /^[a-f0-9]{40}$/.test(actual.tree ?? '') && actual.revision === expected.revision && actual.tree === expected.tree && (actual.repository === undefined || actual.repository === expected.repository);
}

function profileFacts(input) {
  const candidates = input.profiles;
  const editor = candidates?.['editor-desktop'];
  if (!validSource(candidates?.['csharp-host']?.source) || !validSource(candidates?.['local-application-bridge']?.source) || !validSource(editor?.source) || !candidates?.['d008-hosted-product']?.authority || !Array.isArray(editor.artifacts) || editor.artifacts.length !== editorRids.length) fail('profile source or artifact facts are incomplete');
  const rids = editor.artifacts.map((artifact) => artifact?.runtimeIdentifier).sort();
  if (!same(rids, [...editorRids].sort()) || editor.artifacts.some((artifact) => !/^[a-f0-9]{64}$/.test(artifact?.sha256 ?? '')) || !/^[a-f0-9]{40}$/.test(candidates['d008-hosted-product'].authority.revision ?? '') || !/^[a-f0-9]{40}$/.test(candidates['d008-hosted-product'].authority.tree ?? '') || !/^[a-f0-9]{64}$/.test(candidates['d008-hosted-product'].authority.sha256 ?? '')) fail('profile source or artifact facts are malformed');
  return candidates;
}

function onlyFacts(citation, expected) {
  if (!same(citation.facts, expected)) fail(`citation '${citation.id}' declares facts unrelated to its assigned profile`);
}

function validateProfileLinks(candidates, supplied) {
  const journey = Object.fromEntries(Object.entries(supplied).map(([id, value]) => [id, value.journey]));
  const citation = Object.fromEntries(Object.entries(supplied).map(([id, value]) => [id, value.citation]));
  const host = candidates['csharp-host'].source;
  const bridge = candidates['local-application-bridge'].source;
  const editor = candidates['editor-desktop'];
  const authority = candidates['d008-hosted-product'].authority;

  const rolloutAuthority = journey['w30-rollout']?.releaseAuthority;
  if (!rolloutAuthority || rolloutAuthority.revision !== authority.revision || rolloutAuthority.tree !== authority.tree || rolloutAuthority.digest !== authority.sha256) fail('D008 authority facts do not match the hosted rollout citation');
  onlyFacts(citation['w30-rollout'], [{ revision: authority.revision, tree: authority.tree }]);

  const localizedDesktop = journey['w40-localization']?.inputs?.desktop?.sha256;
  if (!/^[a-f0-9]{64}$/.test(localizedDesktop ?? '')) fail('localization citation lacks its desktop evidence identity');
  onlyFacts(citation['w40-localization'], [{ sha256: localizedDesktop }]);

  const supportTool = journey['w50-support']?.tool?.sha256;
  if (!/^[a-f0-9]{64}$/.test(supportTool ?? '')) fail('support citation lacks its tool artifact identity');
  onlyFacts(citation['w50-support'], [{ sha256: supportTool }]);

  const diagnosticSchema = journey['w50-recovery']?.diagnostics?.schema;
  if (diagnosticSchema !== 'runic.translations.editor-diagnostics/1') fail('recovery citation lacks its diagnostics identity');
  onlyFacts(citation['w50-recovery'], [{ diagnostics: { schema: diagnosticSchema } }]);

  if (!sourceMatches(journey['w50-quality']?.localProfiles?.toolkit, bridge)) fail('local Application Bridge source does not match its quality citation');
  onlyFacts(citation['w50-quality'], [{ revision: bridge.revision, tree: bridge.tree }]);

  const candidateSet = journey['w60-candidate']?.candidateSet;
  if (!sourceMatches(candidateSet?.source, editor.source)) fail('Editor source does not match its unsigned candidate citation');
  const candidatePlatforms = candidateSet?.platforms;
  if (!Array.isArray(candidatePlatforms) || candidatePlatforms.length !== editorRids.length) fail('Editor candidate citation has incomplete platform facts');
  for (const artifact of editor.artifacts) {
    const platform = candidatePlatforms.find((item) => item.runtimeIdentifier === artifact.runtimeIdentifier);
    if (!platform || !sourceMatches(platform.source, editor.source) || platform.archive?.sha256 !== artifact.sha256) fail(`Editor artifact '${artifact.runtimeIdentifier}' does not match its unsigned candidate citation`);
  }
  onlyFacts(citation['w60-candidate'], [{ revision: editor.source.revision, tree: editor.source.tree }]);

  const toolStaging = journey['w60-tool']?.toolStaging;
  if (!sourceMatches(toolStaging?.source, host)) fail('C# host source does not match its direct-tool citation');
  onlyFacts(citation['w60-tool'], [{ revision: host.revision, tree: host.tree }]);

  const preflight = journey['w60-preflight']?.provenance;
  if (preflight?.candidateReceipt?.sha256 !== citation['w60-candidate'].sha256 || preflight?.authority?.sha256 !== authority.sha256) fail('manual replacement citation does not bind the frozen Editor candidate and authority');
  onlyFacts(citation['w60-preflight'], [{ sha256: preflight.candidateReceipt.sha256 }]);

  const handoffTool = journey['w60-handoff']?.receipts?.filter((item) => item.artifact?.identity === 'dotnet-runic');
  if (!Array.isArray(handoffTool) || handoffTool.length !== 1 || !sourceMatches(handoffTool[0].source, host)) fail('C# host source does not match its publication-handoff citation');
  const transport = journey['w60-handoff']?.transport;
  if (!same(transport, { outboundRequests: 0, signaturesIssued: 0, signedMetadataEmitted: 0, releaseMutations: 0, uploads: 0, tags: 0 })) fail('publication-handoff citation has external actions');
  onlyFacts(citation['w60-handoff'], [{ transport }]);
}

function validateInput(input, citations) {
  const profileNames = ['csharp-host', 'local-application-bridge', 'editor-desktop', 'd008-hosted-product'];
  if (input?.schema !== 'runic.controlled-nonpublic-profile-input/1' || input.publication !== 'forbidden' || !same(Object.keys(input.profiles ?? {}).sort(), [...profileNames].sort()) || !Array.isArray(input.citations) || input.citations.length !== Object.keys(citations).length) fail('input is not the closed four-profile publication-forbidden shape');
  const ids = new Set();
  const supplied = {};
  for (const citation of input.citations) {
    if (!citation?.id || ids.has(citation.id) || citation.profile !== citationProfiles[citation.id] || !/^[a-f0-9]{64}$/.test(citation.sha256 ?? '') || !Array.isArray(citation.facts)) fail('citation is missing, duplicate, cross-profile, or malformed');
    ids.add(citation.id);
    const path = citations[citation.id];
    if (!path || hash(path) !== citation.sha256) fail(`citation '${citation.id}' is stale or missing`);
    const receipt = read(path, `citation '${citation.id}'`);
    if (receipt.schema !== citation.schema) fail(`citation '${citation.id}' has a schema mismatch`);
    if (!citation.facts.every((fact) => contains(receipt, fact))) fail(`citation '${citation.id}' does not bind its declared facts`);
    supplied[citation.id] = { citation, journey: repeated(receipt, citation.schema) };
  }
  if (Object.keys(citations).some((id) => !ids.has(id))) fail('extra citation input is not allowed');
  validateProfileLinks(profileFacts(input), supplied);
  return input;
}

export function freeze(input, citations) {
  const value = validateInput(input, citations);
  return {
    schema,
    publication: 'forbidden',
    support: {
      profiles: ['csharp-host', 'local-application-bridge', 'editor-desktop', 'd008-hosted-product'],
      nonSupport: ['publication', 'release-version-assignment', 'signing', 'notarization', 'attestation-issuance', 'updates', 'native-platform-certification', 'c-webui-abi-change', 'hosted-topology-change'],
    },
    profiles: value.profiles,
    citations: value.citations.map(({ id, profile, schema: citationSchema, sha256, facts }) => ({ id, profile, schema: citationSchema, sha256, facts })).sort((left, right) => left.id.localeCompare(right.id)),
    externalActions: { requests: 0, signatures: 0, metadata: 0, releases: 0, uploads: 0, tags: 0 },
  };
}

export function runTwice(input, citations) {
  const first = freeze(input, citations), second = freeze(input, citations);
  if (!same(first, second)) fail('re-link is not deterministic');
  return { schema: repeatSchema, journeys: [first, second] };
}

function args(values) {
  const result = {}; for (let index = 0; index < values.length; index += 2) { if (!values[index]?.startsWith('--') || !values[index + 1] || result[values[index]]) fail('usage'); result[values[index]] = values[index + 1]; } return result;
}
function citationPaths(options) {
  const names = ['w30-rollout', 'w40-localization', 'w50-support', 'w50-recovery', 'w50-quality', 'w60-candidate', 'w60-tool', 'w60-preflight', 'w60-handoff'];
  const result = {}; for (const name of names) { const path = options[`--${name}`]; if (!path) fail(`--${name} is required`); result[name] = path; } return result;
}
function main(argv) {
  const [command, ...rest] = argv; const options = args(rest); const input = read(options['--profile'], 'profile'); const citations = citationPaths(options);
  if (command === 'run-twice' && !options['--receipt']) return JSON.stringify(runTwice(input, citations), null, 2);
  if (command === 'verify-twice' && options['--receipt']) { if (!same(read(options['--receipt'], 'freeze receipt'), runTwice(input, citations))) fail('receipt differs from exact local inputs'); return; }
  fail('Usage: freeze-controlled-candidate.mjs run-twice|verify-twice --profile <profile.json> --w30-rollout <receipt> --w40-localization <receipt> --w50-support <receipt> --w50-recovery <receipt> --w50-quality <receipt> --w60-candidate <receipt> --w60-tool <receipt> --w60-preflight <receipt> --w60-handoff <receipt> [--receipt <receipt.json>]');
}
if (import.meta.url === `file://${process.argv[1]}`) { try { const output = main(process.argv.slice(2)); if (output) process.stdout.write(`${output}\n`); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; } }
