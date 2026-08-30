#!/usr/bin/env node
/*
 * Local-only W110 quality composition. It neither produces a release nor
 * expands Linux evidence into Windows/macOS claims.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyCompatibilitySet, verifyWorkspace } from './verify-compatibility-set.mjs';
import { verify as verifyRelease } from './verify-release-manifest.mjs';

export const journeySchema = 'runic.w110-desktop-quality/1';
export const repeatSchema = 'runic.w110-desktop-quality-repeat/1';
export const zeroActions = { requests: 0, publications: 0, signatures: 0, updates: 0, uploads: 0, releases: 0, tags: 0 };

const shaPattern = /^[a-f0-9]{64}$/;
const revisionPattern = /^[a-f0-9]{40}$/;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const stable = (items, key) => [...items].sort((left, right) => String(key(left)).localeCompare(String(key(right))));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(`W110 Desktop quality: ${message}`); };
const readJson = (path, label) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { fail(`${label} must be valid JSON`); } };
const readBytes = (path, label) => { try { return readFileSync(path); } catch { fail(`${label} is missing or unreadable`); } };

const editorChecks = [
  { id: 'application-accessibility', args: ['test/verify-keyboard-a11y.mjs'], facts: ['Svelte compiler accessibility diagnostics', 'keyboard focus ownership', 'landmarks and accessible names', 'forced-colors focus', 'reduced motion'] },
  { id: 'catalog-backed-ui-copy', args: ['test/verify-ui-catalog.mjs'], facts: ['English and German visible/accessibility copy catalog coverage'] },
  { id: 'catalog-backed-message-list', args: ['test/verify-message-list-catalog.mjs'], facts: ['message list visible/accessibility copy catalog coverage'] },
  { id: 'virtualized-10k-50k', args: ['test/verify-message-virtualization.mjs'], facts: ['10,000 and 50,000 message virtual tree build budgets', 'bounded viewport rows', '100 scroll-window interaction budget'] },
  { id: 'indexed-search-10k-50k', args: ['test/verify-message-search.mjs'], facts: ['10,000 and 50,000 multi-locale index/query budgets'] },
  { id: 'review-model-50k-memory', args: ['--expose-gc', 'test/verify-review-model.mjs'], facts: ['50,000 messages across 100 review locales', '256 MiB retained heap-growth ceiling', 'bounded translation-memory suggestions'] },
];
const editorEvidenceFiles = [
  'Frontend/test/verify-keyboard-a11y.mjs',
  'Frontend/test/verify-ui-catalog.mjs',
  'Frontend/test/verify-message-list-catalog.mjs',
  'Frontend/test/verify-message-virtualization.mjs',
  'Frontend/test/verify-message-search.mjs',
  'Frontend/test/verify-review-model.mjs',
  'Frontend/src/lib/message-virtualization.ts',
  'Frontend/src/lib/message-search.ts',
  'Frontend/src/lib/review-model.ts',
];
const desktopPhases = ['locked-node-install', 'contract-verification', 'browser-transport-build', 'managed-build', 'representative-managed-quality-tests', 'embedded-webview-smoke', 'npm-package-consumer'];
const desktopClaims = {
  multiWindow: { surfaces: 2, concurrentWindowCycles: 24, postcondition: 'application-not-running' },
  streaming: { headStreamFactoryCalls: 0, streamedFirstChunkBytes: 5, streamFactoryCalls: 1, cancellation: 'request-disconnect-and-window-close', disposal: 'required' },
  reconnect: { authenticatedConnections: 2, connectionIds: 'distinct' },
  cleanRecovery: { ownedBrowserLaunches: 2, generatedProfiles: 'unique-and-cleaned', unexpectedBrowserExit: 'detected-and-cleaned', embeddedWebViewRestart: 'second-surface-window' },
};

function git(repository, args) {
  const result = execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return result.trimEnd();
}
function gitBytes(repository, args) {
  return execFileSync('git', ['-C', repository, ...args], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] });
}
function gitBlob(repository, revision, path) {
  try { return gitBytes(repository, ['show', `${revision}:${path}`]); }
  catch { fail(`${path} is unavailable at ${revision} in ${repository}`); }
}
function gitTree(repository, revision) {
  try { return git(repository, ['rev-parse', `${revision}^{tree}`]); }
  catch { fail(`${repository} does not contain ${revision}`); }
}
function assertExactWorktree(repository, revision, label) {
  if (git(repository, ['rev-parse', 'HEAD']) !== revision) fail(`${label} worktree HEAD differs from pinned authority revision`);
  if (git(repository, ['status', '--porcelain=v1', '--untracked-files=all']) !== '') fail(`${label} worktree is not clean`);
}
function sourceFacts(compatibility, workspace) {
  return stable(compatibility.sources, (item) => item.repository).map((source) => ({
    repository: source.repository,
    revision: source.revision,
    tree: gitTree(resolve(workspace, source.repository), source.revision),
  }));
}
function contractFacts(compatibility) {
  return stable(compatibility.contracts, (item) => item.id)
    .map(({ id, repository, path, algorithm, sha256 }) => ({ id, repository, path, algorithm, sha256 }));
}
function requiredDesktopReceipt(receipt, compatibility) {
  if (receipt?.schema !== 'runic.desktop.linux-native-quality-repeat/1' || !Array.isArray(receipt.journeys) || receipt.journeys.length !== 2 || !same(receipt.journeys[0], receipt.journeys[1])) fail('Desktop native receipt is not an exact two-run Linux receipt');
  const journey = receipt.journeys[0];
  if (journey?.schema !== 'runic.desktop.linux-native-quality/1' || journey.profile?.os?.family !== 'linux' || journey.profile?.architecture !== 'x64') fail('Desktop native receipt does not prove the Linux x64 profile');
  const packages = new Map(compatibility.packages.map((item) => [`${item.ecosystem}:${item.identity}`, item.version]));
  if (journey.profile?.packages?.dotnet?.version !== packages.get('nuget:Runic.Desktop') || journey.profile?.packages?.transport?.version !== packages.get('npm:@runic-artifex/desktop')) fail('Desktop native receipt package versions drift from compatibility authority');
  const contract = compatibility.contracts.find((item) => item.id === 'runic-desktop-presentation');
  if (journey.profile?.packages?.contract?.id !== 'runic.desktop.presentation' || !contract) fail('Desktop native receipt does not bind the presentation contract');
  if (!shaPattern.test(journey.inputs?.implementationSha256 ?? '') || !shaPattern.test(journey.inputs?.evidenceSha256 ?? '')) fail('Desktop native receipt source fingerprints are malformed');
  for (const [name, facts] of Object.entries(desktopClaims)) {
    if (!journey.evidence?.[name] || Object.entries(facts).some(([key, value]) => journey.evidence[name][key] !== value)) fail(`Desktop native receipt weakens ${name} evidence`);
  }
  if (!Array.isArray(journey.phases) || !same(journey.phases.map((phase) => phase.name), desktopPhases) || journey.phases.some((phase) => phase.status !== 'passed' || phase.exitCode !== 0)) fail('Desktop native receipt does not retain every passed native phase');
  for (const name of ['accessibility', 'performance', 'memory', 'windows', 'macos']) {
    if (journey.exclusions?.[name]?.status !== 'not-certified') fail(`Desktop native receipt softens its ${name} exclusion`);
  }
  return {
    platform: 'linux-x64',
    profile: { os: journey.profile.os, architecture: journey.profile.architecture, runtime: journey.profile.runtime, browser: journey.profile.browser, embeddedWebView: journey.profile.embeddedWebView },
    claims: desktopClaims,
    exclusions: ['accessibility', 'performance', 'memory', 'windows', 'macos'].map((name) => ({ id: name, status: 'not-certified', reason: journey.exclusions[name].reason })),
  };
}
function editorFacts(editorPath, editorRevision) {
  return stable(editorEvidenceFiles, (path) => path).map((path) => ({ path, sha256: hash(gitBlob(editorPath, editorRevision, path)) }));
}
function authorityFacts(input) {
  const releaseErrors = verifyRelease(input.release, input.releaseSchema);
  if (releaseErrors.length) fail(`release authority verification failed: ${releaseErrors.join('; ')}`);
  const compatibilityErrors = verifyCompatibilitySet(input.compatibility, input.compatibilitySchema, input.release);
  if (compatibilityErrors.length) fail(`compatibility authority verification failed: ${compatibilityErrors.join('; ')}`);
  const workspaceErrors = verifyWorkspace(input.compatibility, input.workspace);
  if (workspaceErrors.length) fail(`workspace authority verification failed: ${workspaceErrors.join('; ')}`);
  const desktop = input.compatibility.sources.find((item) => item.repository === 'runic-desktop');
  const editor = input.compatibility.sources.find((item) => item.repository === 'runic-translations-editor');
  if (!desktop || !editor || !revisionPattern.test(desktop.revision) || !revisionPattern.test(editor.revision)) fail('Desktop or Editor source is missing from compatibility authority');
  return { desktop, editor };
}

export function createQualityJourney(input) {
  const { desktop, editor } = authorityFacts(input);
  const desktopPath = resolve(input.workspace, desktop.repository);
  const editorPath = resolve(input.workspace, editor.repository);
  const nativeReceiptPath = 'evidence/native-quality/linux-x64.json';
  const nativeReceipt = readJsonBuffer(gitBlob(desktopPath, desktop.revision, nativeReceiptPath), 'Desktop Linux quality receipt');
  const native = requiredDesktopReceipt(nativeReceipt, input.compatibility);
  return {
    schema: journeySchema,
    publication: 'forbidden',
    externalActions: zeroActions,
    authority: {
      release: { sha256: hash(readBytes(input.releasePath, 'release authority')), schema: input.release.$schema, schemaVersion: input.release.schemaVersion },
      compatibility: { sha256: hash(readBytes(input.compatibilityPath, 'compatibility authority')), id: input.compatibility.id, releaseTrainVersion: input.compatibility.releaseTrainVersion, schemaVersion: input.compatibility.schemaVersion },
    },
    sources: sourceFacts(input.compatibility, input.workspace),
    contracts: contractFacts(input.compatibility),
    platformAuthority: stable(input.compatibility.platformProfiles, (item) => item),
    observedPlatforms: ['linux-x64'],
    application: {
      product: 'runic-translations-editor',
      source: { repository: editor.repository, revision: editor.revision },
      accessibility: { scope: 'static editor UI semantics and catalog coverage', checks: editorChecks.slice(0, 3).map(({ id, facts }) => ({ id, facts })) },
      scale: { checks: editorChecks.slice(3).map(({ id, facts }) => ({ id, facts })) },
      evidenceFiles: editorFacts(editorPath, editor.revision),
    },
    desktopRuntime: {
      source: { repository: desktop.repository, revision: desktop.revision, path: nativeReceiptPath, sha256: hash(gitBlob(desktopPath, desktop.revision, nativeReceiptPath)) },
      ...native,
    },
    exclusions: {
      windows: 'not-certified-by-this-local-evidence',
      macos: 'not-certified-by-this-local-evidence',
      applicationAssistiveTechnology: 'not-certified-by-static-checks',
      nativeLatencyOrThroughput: 'not-certified-by-structural-capacity-check',
      nativeMemory: 'not-certified-by-this-local-evidence',
      publication: 'forbidden',
    },
  };
}

function readJsonBuffer(value, label) { try { return JSON.parse(value.toString('utf8')); } catch { fail(`${label} must be valid JSON`); } }
function runEditorChecks(input) {
  const { desktop, editor } = authorityFacts(input);
  const desktopPath = resolve(input.workspace, desktop.repository);
  const editorPath = resolve(input.workspace, editor.repository);
  assertExactWorktree(desktopPath, desktop.revision, 'Runic Desktop');
  assertExactWorktree(editorPath, editor.revision, 'Translations Editor');
  for (const check of editorChecks) {
    try { execFileSync(process.execPath, check.args, { cwd: resolve(editorPath, 'Frontend'), stdio: 'pipe' }); }
    catch (error) { fail(`Editor ${check.id} check failed: ${String(error.stderr ?? error.message).trim()}`); }
  }
}

export function runTwice(input, { verifyChecks = true } = {}) {
  const journeys = [];
  for (let run = 0; run < 2; run += 1) {
    if (verifyChecks) runEditorChecks(input);
    journeys.push(createQualityJourney(input));
  }
  if (!same(journeys[0], journeys[1])) fail('two isolated quality constructions produced different evidence');
  return { schema: repeatSchema, journeys };
}
export function verifyReceipt(input, receipt, options) {
  const expected = runTwice(input, options);
  if (!same(receipt, expected)) fail('retained W110 quality receipt differs from exact local evidence');
  return expected;
}

function options(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index], value = values[index + 1];
    if (!key?.startsWith('--') || !value || result[key]) fail('invalid command line');
    result[key] = value;
  }
  return result;
}
function main(argv) {
  const [command, ...rest] = argv, args = options(rest);
  const required = ['--release', '--release-schema', '--compatibility', '--compatibility-schema', '--workspace'];
  if (required.some((key) => !args[key])) fail('required authority and workspace inputs are missing');
  const input = {
    releasePath: resolve(args['--release']),
    compatibilityPath: resolve(args['--compatibility']),
    workspace: resolve(args['--workspace']),
  };
  input.release = readJson(input.releasePath, 'release authority');
  input.releaseSchema = readJson(resolve(args['--release-schema']), 'release schema');
  input.compatibility = readJson(input.compatibilityPath, 'compatibility authority');
  input.compatibilitySchema = readJson(resolve(args['--compatibility-schema']), 'compatibility schema');
  if (command === 'run-twice' && !args['--receipt']) return JSON.stringify(runTwice(input), null, 2);
  if (command === 'verify-twice' && args['--receipt']) { verifyReceipt(input, readJson(resolve(args['--receipt']), 'W110 quality receipt')); return; }
  fail('Usage: w110-desktop-quality.mjs run-twice|verify-twice --release <release.json> --release-schema <schema.json> --compatibility <set.json> --compatibility-schema <schema.json> --workspace <workspace> [--receipt <receipt.json>]');
}
if (import.meta.url === `file://${process.argv[1]}`) { try { const output = main(process.argv.slice(2)); if (output) process.stdout.write(`${output}\n`); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; } }
