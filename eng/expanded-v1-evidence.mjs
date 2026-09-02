#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export const evidenceSchema = 'runic.expanded-v1-readiness-evidence/1';
export const zeroActions = { requests: 0, publications: 0, signatures: 0, updates: 0, uploads: 0, releases: 0, tags: 0 };
const exclusions = ['unsigned', 'non-public', 'publication', 'signing', 'notarization', 'attestation-issuance', 'version-assignment', 'updates', 'automatic-operator-action', 'rust-support', 'cpp-support', 'c-webui-abi-source-work', 'hosted-topology-change'];
const platforms = ['linux-x64', 'osx-arm64', 'osx-x64', 'win-x64'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const fail = (message) => { throw new Error(`expanded v1 evidence: ${message}`); };
const read = (path, label) => { try { const bytes = readFileSync(path); return { bytes, value: JSON.parse(bytes) }; } catch { fail(`${label} must be readable JSON`); } };
const passed = (phase) => phase?.status === 'passed' && phase.exitCode === 0;

function exactRepeat(input, schema, label) {
  if (input.value?.schema !== schema || input.value.journeys?.length !== 2 || !same(input.value.journeys[0], input.value.journeys[1])) fail(`${label} is not the expected deterministic repeat receipt`);
}

function authorityFacts(compatibility, sourceNames, contractNames) {
  const sources = new Map(compatibility.sources.map((item) => [item.repository, item]));
  const contracts = new Map(compatibility.contracts.map((item) => [item.id, item]));
  return {
    sources: sourceNames.map((repository) => { const item = sources.get(repository); if (!item) fail(`compatibility source ${repository} is missing`); return { repository, revision: item.revision }; }),
    contracts: contractNames.map((id) => { const item = contracts.get(id); if (!item) fail(`compatibility contract ${id} is missing`); return { id, sha256: item.sha256 }; }),
  };
}

function wrapper(schema, milestone, inputs, facts, extra = {}) {
  const journey = { schema: schema.replace('-repeat/1', '/1'), publication: 'forbidden', externalActions: zeroActions, milestone, inputs, authority: facts, ...extra };
  return { schema, journeys: [journey, structuredClone(journey)] };
}

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); return readFileSync(path); }

export function materialize(input) {
  const compatibility = read(input.compatibilityPath, 'compatibility authority');
  if (compatibility.value?.publication !== 'forbidden') fail('compatibility authority is not publication-forbidden');
  const w80 = read(input.w80Path, 'W80 receipt');
  exactRepeat(w80, 'runic.local-1.0-readiness-index-repeat/1', 'W80 receipt');
  if (w80.value.journeys[0]?.publication !== 'forbidden' || !same(w80.value.journeys[0]?.externalActions, zeroActions)) fail('W80 receipt contains external actions');
  const w90 = read(input.w90Path, 'W90 conformance receipt');
  if (w90.value?.format !== 'runic.desktop.conformance-receipt/1' || !Array.isArray(w90.value.results) || w90.value.results.length < 1 || w90.value.results.some((item) => item.outcome !== 'pass')) fail('W90 conformance evidence is incomplete');
  const w100First = read(input.w100FirstPath, 'first W100 receipt'), w100Second = read(input.w100SecondPath, 'second W100 receipt');
  const w100Validation = w100First.value?.validation;
  if (w100First.value?.schema !== 'runic.desktop.w100-golden-path/1' || !w100First.bytes.equals(w100Second.bytes) || !w100Validation || Object.values(w100Validation).some((items) => !Array.isArray(items) || items.length === 0)) fail('W100 evidence is not two byte-identical complete constructions');
  const w105Clean = read(input.w105CleanPath, 'W105 clean-install receipt'), w105Localized = read(input.w105LocalizedPath, 'W105 localized receipt');
  exactRepeat(w105Clean, 'runic.current-clean-install-repeat/3', 'W105 clean-install receipt');
  exactRepeat(w105Localized, 'runic.localized-desktop-product-repeat/1', 'W105 localized receipt');
  for (const [label, item] of [['clean-install', w105Clean], ['localized', w105Localized]]) if (!Array.isArray(item.value.journeys[0]?.phases) || item.value.journeys[0].phases.some((phase) => !passed(phase))) fail(`W105 ${label} phases are incomplete`);
  const w110 = read(input.w110Path, 'W110 quality receipt');
  exactRepeat(w110, 'runic.w110-desktop-quality-repeat/1', 'W110 quality receipt');
  if (w110.value.journeys[0]?.publication !== 'forbidden' || !same(w110.value.journeys[0]?.externalActions, zeroActions) || !same(w110.value.journeys[0]?.observedPlatforms, platforms)) fail('W110 receipt does not certify the complete platform set without external actions');

  const allSources = compatibility.value.sources.map((item) => item.repository).sort();
  const allContracts = compatibility.value.contracts.map((item) => item.id).sort();
  const w100Sources = ['runic-assets', 'runic-desktop', 'runic-svelte', 'runic-toolkit', 'runic-toolkit-examples', 'runic-translations', 'runic-translations-editor', 'runic-vite'];
  const w100Contracts = ['runic-application-bridge', 'runic-assets', 'runic-desktop-presentation', 'runic-translations'];
  mkdirSync(join(input.outputDir, 'inputs'), { recursive: true });
  const retained = [
    ['w80-readiness.json', w80], ['w90-desktop-conformance.json', w90], ['w100-golden-path-first.json', w100First], ['w100-golden-path-second.json', w100Second],
    ['w105-clean-install.json', w105Clean], ['w105-localized-desktop.json', w105Localized], ['w110-desktop-quality.json', w110],
  ];
  for (const [name, item] of retained) writeFileSync(join(input.outputDir, 'inputs', name), item.bytes);
  const inputFact = (name, item) => ({ path: `inputs/${name}`, schema: item.value.schema ?? item.value.format, sha256: sha256(item.bytes) });
  const receipts = [
    ['w90-desktop-conformance', 'W90', 'runic.w90-desktop-conformance-repeat/1', wrapper('runic.w90-desktop-conformance-repeat/1', 'W90', [inputFact('w90-desktop-conformance.json', w90), inputFact('w110-desktop-quality.json', w110)], authorityFacts(compatibility.value, ['runic-desktop'], ['runic-desktop-presentation']), { results: { total: w90.value.results.length, passed: w90.value.results.length }, platforms }), ['runic-desktop'], ['runic-desktop-presentation'], platforms],
    ['w100-golden-path', 'W100', 'runic.w100-golden-path-repeat/1', wrapper('runic.w100-golden-path-repeat/1', 'W100', [inputFact('w100-golden-path-first.json', w100First), inputFact('w100-golden-path-second.json', w100Second)], authorityFacts(compatibility.value, w100Sources, w100Contracts), { repeatedEvidence: 'byte-identical', status: 'passed' }), w100Sources, w100Contracts, []],
    ['w105-experience-closure', 'W105', 'runic.w105-experience-closure-repeat/1', wrapper('runic.w105-experience-closure-repeat/1', 'W105', [inputFact('w105-clean-install.json', w105Clean), inputFact('w105-localized-desktop.json', w105Localized)], authorityFacts(compatibility.value, allSources, allContracts), { closure: 'complete', status: 'passed' }), allSources, allContracts, []],
  ];
  const citations = receipts.map(([id, milestone, schema, receipt, sourceNames, contractNames, selectedPlatforms]) => {
    const path = `${id}.json`, bytes = writeJson(join(input.outputDir, path), receipt), facts = authorityFacts(compatibility.value, sourceNames, contractNames);
    return { id, milestone, schema, path, sha256: sha256(bytes), ...facts, platforms: selectedPlatforms, ...(id === 'w105-experience-closure' ? { closure: 'complete' } : {}) };
  });
  const w110Facts = authorityFacts(compatibility.value, allSources, allContracts);
  citations.push({ id: 'w110-desktop-quality', milestone: 'W110', schema: 'runic.w110-desktop-quality-repeat/1', path: 'inputs/w110-desktop-quality.json', sha256: sha256(w110.bytes), ...w110Facts, platforms });
  citations.sort((left, right) => left.id.localeCompare(right.id));
  const evidence = { schema: evidenceSchema, publication: 'forbidden', externalActions: zeroActions, w80: { status: 'historical', schema: w80.value.schema, path: 'inputs/w80-readiness.json', sha256: sha256(w80.bytes) }, languageProfiles: compatibility.value.languageProfiles, exclusions, citations };
  writeJson(join(input.outputDir, 'evidence.json'), evidence);
  return evidence;
}

function options(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) { const key = values[index], value = values[index + 1]; if (!key?.startsWith('--') || !value || result[key]) fail('invalid command line'); result[key] = value; }
  return result;
}
function main(argv) {
  const [command, ...rest] = argv, args = options(rest);
  const mapping = { compatibilityPath: '--compatibility', w80Path: '--w80', w90Path: '--w90', w100FirstPath: '--w100-first', w100SecondPath: '--w100-second', w105CleanPath: '--w105-clean', w105LocalizedPath: '--w105-localized', w110Path: '--w110', outputDir: '--output-dir' };
  if (command !== 'materialize' || Object.values(mapping).some((key) => !args[key])) fail(`usage: ${basename(process.argv[1])} materialize --compatibility <json> --w80 <json> --w90 <json> --w100-first <json> --w100-second <json> --w105-clean <json> --w105-localized <json> --w110 <json> --output-dir <dir>`);
  materialize(Object.fromEntries(Object.entries(mapping).map(([name, key]) => [name, resolve(args[key])])));
}
if (import.meta.main) { try { main(process.argv.slice(2)); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; } }
