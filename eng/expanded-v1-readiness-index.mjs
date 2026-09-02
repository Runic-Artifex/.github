#!/usr/bin/env node
/*
 * Local-only W110 readiness decision input.  This intentionally indexes
 * evidence; it does not create, publish, sign, or otherwise endorse it.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { verify as verifyRelease } from './verify-release-manifest.mjs';
import { verifyCompatibilitySet, verifyWorkspace } from './verify-compatibility-set.mjs';

export const schema = 'runic.expanded-v1-readiness-index/1';
export const repeatSchema = 'runic.expanded-v1-readiness-index-repeat/1';
export const evidenceSchema = 'runic.expanded-v1-readiness-evidence/1';

const shaPattern = /^[a-f0-9]{64}$/;
const revisionPattern = /^[a-f0-9]{40}$/;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const fail = (message) => { throw new Error(`expanded v1 readiness index: ${message}`); };
const hash = (value) => createHash('sha256').update(value).digest('hex');
const read = (path, label) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { fail(`${label} must be valid JSON`); } };
const hashFile = (path, label) => { try { return hash(readFileSync(path)); } catch { fail(`${label} is missing or unreadable`); } };
const stable = (items, key) => [...items].sort((left, right) => String(key(left)).localeCompare(String(key(right))));
const exact = (actual, expected, label) => { if (!same(actual, expected)) fail(label); };
const zeroActions = { requests: 0, publications: 0, signatures: 0, updates: 0, uploads: 0, releases: 0, tags: 0 };
const exclusions = ['unsigned', 'non-public', 'publication', 'signing', 'notarization', 'attestation-issuance', 'version-assignment', 'updates', 'automatic-operator-action', 'rust-support', 'cpp-support', 'c-webui-abi-source-work', 'hosted-topology-change'];
const certifiedPlatforms = ['linux-x64', 'osx-arm64', 'osx-x64', 'win-x64'];
const requiredEvidence = {
  'w90-desktop-conformance': { milestone: 'W90', schema: 'runic.w90-desktop-conformance-repeat/1', sources: ['runic-desktop'], contracts: ['runic-desktop-presentation'], platforms: certifiedPlatforms },
  'w100-golden-path': { milestone: 'W100', schema: 'runic.w100-golden-path-repeat/1', sources: ['runic-assets', 'runic-desktop', 'runic-svelte', 'runic-toolkit', 'runic-toolkit-examples', 'runic-translations', 'runic-translations-editor', 'runic-vite'], contracts: ['runic-application-bridge', 'runic-assets', 'runic-desktop-presentation', 'runic-translations'], platforms: [] },
  'w105-experience-closure': { milestone: 'W105', schema: 'runic.w105-experience-closure-repeat/1', sources: null, contracts: null, platforms: [] },
  'w110-desktop-quality': { milestone: 'W110', schema: 'runic.w110-desktop-quality-repeat/1', sources: null, contracts: null, platforms: certifiedPlatforms },
};

function relativeInput(base, value, label) {
  if (typeof value !== 'string' || !value || isAbsolute(value) || value.includes('\\')) fail(`${label} path must be a non-empty relative POSIX path`);
  const path = resolve(base, value);
  if (relative(base, path).startsWith('..')) fail(`${label} path escapes its evidence directory`);
  return path;
}

function sourceFacts(items, sourceMap, label) {
  if (!Array.isArray(items)) fail(`${label}.sources must be an array`);
  const facts = stable(items, (item) => item.repository);
  if (new Set(facts.map((item) => item?.repository)).size !== facts.length) fail(`${label}.sources contains duplicate repositories`);
  for (const item of facts) {
    const expected = sourceMap.get(item?.repository);
    if (!expected || item.revision !== expected.revision || !revisionPattern.test(item.revision ?? '')) fail(`${label}.sources contains a stale or unknown source`);
  }
  return facts.map(({ repository, revision }) => ({ repository, revision }));
}

function contractFacts(items, contractMap, label) {
  if (!Array.isArray(items)) fail(`${label}.contracts must be an array`);
  const facts = stable(items, (item) => item.id);
  if (new Set(facts.map((item) => item?.id)).size !== facts.length) fail(`${label}.contracts contains duplicate identities`);
  for (const item of facts) {
    const expected = contractMap.get(item?.id);
    if (!expected || item.sha256 !== expected.sha256 || !shaPattern.test(item.sha256 ?? '')) fail(`${label}.contracts contains a stale or unknown contract`);
  }
  return facts.map(({ id, sha256 }) => ({ id, sha256 }));
}

function receiptFact(base, citation, sourceMap, contractMap) {
  if (!citation || typeof citation !== 'object' || Array.isArray(citation)) fail('evidence citation must be an object');
  const expected = requiredEvidence[citation.id];
  if (!expected || citation.milestone !== expected.milestone || citation.schema !== expected.schema || !shaPattern.test(citation.sha256 ?? '')) fail('evidence citation has an unknown identity, milestone, schema, or digest');
  const path = relativeInput(base, citation.path, `citation '${citation.id}'`);
  if (hashFile(path, `citation '${citation.id}'`) !== citation.sha256) fail(`citation '${citation.id}' is stale or replayed`);
  const receipt = read(path, `citation '${citation.id}'`);
  if (receipt?.schema !== citation.schema || !Array.isArray(receipt.journeys) || receipt.journeys.length !== 2 || !same(receipt.journeys[0], receipt.journeys[1])) fail(`citation '${citation.id}' is not a deterministic repeat receipt`);
  if (receipt.journeys[0]?.publication !== 'forbidden' || !same(receipt.journeys[0]?.externalActions, zeroActions)) fail(`citation '${citation.id}' is publication-bearing or has external actions`);
  const sources = sourceFacts(citation.sources, sourceMap, `citation '${citation.id}'`);
  const contracts = contractFacts(citation.contracts, contractMap, `citation '${citation.id}'`);
  const platforms = stable(citation.platforms ?? [], (item) => item);
  if (new Set(platforms).size !== platforms.length || platforms.some((item) => !certifiedPlatforms.includes(item))) fail(`citation '${citation.id}' has an undeclared platform`);
  exact(sources.map((item) => item.repository), expected.sources ?? [...sourceMap.keys()].sort(), `citation '${citation.id}' does not bind the required sources`);
  exact(contracts.map((item) => item.id), expected.contracts ?? [...contractMap.keys()].sort(), `citation '${citation.id}' does not bind the required contracts`);
  exact(platforms, expected.platforms, `citation '${citation.id}' has an incomplete platform profile`);
  if (citation.id === 'w105-experience-closure' && citation.closure !== 'complete') fail('W105 closure is incomplete');
  return { id: citation.id, milestone: citation.milestone, schema: citation.schema, sha256: citation.sha256, sources, contracts, platforms, ...(citation.id === 'w105-experience-closure' ? { closure: 'complete' } : {}) };
}

function evidenceFacts(evidence, path, compatibility) {
  if (evidence?.schema !== evidenceSchema || evidence.publication !== 'forbidden' || !same(evidence.externalActions, zeroActions)) fail('evidence input is not a local-only, zero-action W110 evidence set');
  if (evidence.w80?.status !== 'historical' || evidence.w80?.schema !== 'runic.local-1.0-readiness-index-repeat/1' || !shaPattern.test(evidence.w80?.sha256 ?? '')) fail('W80 must be retained only as a hashed historical receipt');
  const w80Path = relativeInput(dirname(path), evidence.w80.path, 'W80 historical receipt');
  if (hashFile(w80Path, 'W80 historical receipt') !== evidence.w80.sha256 || read(w80Path, 'W80 historical receipt')?.schema !== evidence.w80.schema) fail('W80 historical receipt is stale or replayed');
  exact(evidence.languageProfiles, compatibility.languageProfiles, 'evidence language profiles do not exactly match compatibility authority');
  exact(stable(evidence.exclusions ?? [], (item) => item), stable(exclusions, (item) => item), 'evidence exclusions are softened, missing, or extended');
  if (!Array.isArray(evidence.citations) || evidence.citations.length !== Object.keys(requiredEvidence).length) fail('evidence must contain exactly the required W90-W110 citations');
  const sourceMap = new Map(compatibility.sources.map((item) => [item.repository, item]));
  const contractMap = new Map(compatibility.contracts.map((item) => [item.id, item]));
  const citations = stable(evidence.citations.map((item) => receiptFact(dirname(path), item, sourceMap, contractMap)), (item) => item.id);
  if (new Set(citations.map((item) => item.id)).size !== citations.length || !same(citations.map((item) => item.id), Object.keys(requiredEvidence).sort())) fail('evidence citations are missing, duplicate, or extra');
  return { w80: { status: 'historical', schema: evidence.w80.schema, sha256: evidence.w80.sha256 }, citations };
}

export function createIndex({ release, releaseSchema, compatibility, compatibilitySchema, evidence, paths = {}, workspace }) {
  const releaseErrors = verifyRelease(release, releaseSchema);
  if (releaseErrors.length) fail(`release authority verification failed: ${releaseErrors.join('; ')}`);
  const compatibilityErrors = verifyCompatibilitySet(compatibility, compatibilitySchema, release);
  if (compatibilityErrors.length) fail(`compatibility authority verification failed: ${compatibilityErrors.join('; ')}`);
  if (workspace) { const workspaceErrors = verifyWorkspace(compatibility, workspace); if (workspaceErrors.length) fail(`workspace source or contract drift: ${workspaceErrors.join('; ')}`); }
  const evidenceFactsValue = evidenceFacts(evidence, paths.evidence ?? '.', compatibility);
  const sources = stable(compatibility.sources, (item) => item.repository).map(({ repository, revision }) => ({ repository, revision }));
  const contracts = stable(compatibility.contracts, (item) => item.id).map(({ id, repository, path, algorithm, sha256 }) => ({ id, repository, path, algorithm, sha256 }));
  const packages = stable(compatibility.packages, (item) => `${item.ecosystem}:${item.identity.toLowerCase()}`).map(({ ecosystem, identity, version, source }) => ({ ecosystem, identity, version, source }));
  const desktopPackages = packages.filter((item) => item.source === 'runic-desktop');
  exact(desktopPackages.map((item) => `${item.ecosystem}:${item.identity}`), ['npm:@runic-artifex/desktop', 'nuget:Runic.Desktop'], 'Runic Desktop package authority is incomplete');
  const authority = {
    release: { sha256: paths.release ? hashFile(paths.release, 'release authority') : hash(Buffer.from(JSON.stringify(release))), schema: release.$schema, schemaVersion: release.schemaVersion },
    compatibility: { sha256: paths.compatibility ? hashFile(paths.compatibility, 'compatibility authority') : hash(Buffer.from(JSON.stringify(compatibility))), id: compatibility.id, releaseTrainVersion: compatibility.releaseTrainVersion, schemaVersion: compatibility.schemaVersion },
  };
  return { schema, publication: 'forbidden', authority, historical: { w80: evidenceFactsValue.w80 }, languageProfiles: compatibility.languageProfiles, platformProfiles: stable(compatibility.platformProfiles, (item) => item), sources, contracts, packages, desktop: { source: 'runic-desktop', contract: 'runic-desktop-presentation', packages: desktopPackages, platforms: certifiedPlatforms }, evidence: evidenceFactsValue.citations, exclusions, externalActions: zeroActions };
}

export function runTwice(input) {
  const first = createIndex(input), second = createIndex(input);
  if (!same(first, second)) fail('two isolated constructions produced different readiness evidence');
  return { schema: repeatSchema, journeys: [first, second] };
}

function options(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) { const key = values[index], value = values[index + 1]; if (!key?.startsWith('--') || !value || result[key]) fail('invalid command line'); result[key] = value; }
  return result;
}
function main(argv) {
  const [command, ...rest] = argv, input = options(rest);
  const required = ['--release', '--release-schema', '--compatibility', '--compatibility-schema', '--evidence'];
  if (required.some((key) => !input[key])) fail('required authority and evidence inputs are missing');
  const paths = { release: resolve(input['--release']), compatibility: resolve(input['--compatibility']), evidence: resolve(input['--evidence']) };
  const value = { release: read(paths.release, 'release authority'), releaseSchema: read(resolve(input['--release-schema']), 'release schema'), compatibility: read(paths.compatibility, 'compatibility authority'), compatibilitySchema: read(resolve(input['--compatibility-schema']), 'compatibility schema'), evidence: read(paths.evidence, 'evidence input'), paths, workspace: input['--workspace'] ? resolve(input['--workspace']) : undefined };
  if (command === 'run-twice' && !input['--receipt']) return JSON.stringify(runTwice(value), null, 2);
  if (command === 'verify-twice' && input['--receipt']) { exact(read(resolve(input['--receipt']), 'readiness receipt'), runTwice(value), 'receipt differs from exact local inputs'); return; }
  fail('Usage: expanded-v1-readiness-index.mjs run-twice|verify-twice --release <release.json> --release-schema <schema.json> --compatibility <set.json> --compatibility-schema <schema.json> --evidence <evidence.json> [--workspace <workspace>] [--receipt <receipt.json>]');
}
if (import.meta.url === `file://${process.argv[1]}`) { try { const output = main(process.argv.slice(2)); if (output) process.stdout.write(`${output}\n`); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; } }
