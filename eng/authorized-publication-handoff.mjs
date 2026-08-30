#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { validate } from './release-evidence.mjs';

const schema = 'runic.authorized-publication-handoff/1';
const repeatSchema = 'runic.authorized-publication-handoff-repeat/1';
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(`authorized publication handoff: ${message}`); };
const sourceEqual = (left, right) => same(left, right);
const noPlaceholders = (value) => typeof value === 'string' ? !/REPLACE_WITH|<[^>]+>/.test(value) : Array.isArray(value) ? value.every(noPlaceholders) : value && typeof value === 'object' ? Object.values(value).every(noPlaceholders) : true;
const json = (path, label) => { try { return JSON.parse(readFileSync(resolve(path), 'utf8')); } catch { fail(`${label} must be valid JSON`); } };

function repeatedCandidate(receipt) {
  if (receipt?.schema !== 'runic.unsigned-candidate-set-consumer-repeat/1' || !Array.isArray(receipt.journeys) || receipt.journeys.length !== 2 || !same(receipt.journeys[0], receipt.journeys[1])) fail('candidate receipt must contain two deterministic journeys');
  const journey = receipt.journeys[0], set = journey?.candidateSet;
  if (journey?.schema !== 'runic.unsigned-candidate-set-consumer/1' || !same(journey.isolation, { workingDirectory: 'temporary-empty' }) || journey.noProductProjectReference !== true || set?.schema !== 'runic.unsigned-candidate-set/1' || set.publication !== 'forbidden' || !Array.isArray(set.platforms) || set.platforms.length !== 3) fail('candidate receipt is not the closed W60-001 consumer shape');
  return set;
}

function repeatedTool(receipt, candidate) {
  if (receipt?.schema !== 'runic.unsigned-tool-staging-consumer-repeat/1' || !Array.isArray(receipt.journeys) || receipt.journeys.length !== 2 || !same(receipt.journeys[0], receipt.journeys[1])) fail('tool receipt must contain two deterministic journeys');
  const journey = receipt.journeys[0], tool = journey?.toolStaging;
  if (journey?.schema !== 'runic.unsigned-tool-staging-consumer/1' || !same(journey.projectReferences, []) || !same(journey.remoteSources, []) || journey.supportEnvelopeContent !== 'forbidden' || journey.canonicalReleaseApproval !== 'seven-package-release-gate-required' || !same(journey.candidateSet, candidate) || tool?.schema !== 'runic.dotnet-runic-unsigned-staging/1' || tool.publication !== 'forbidden' || tool.supportEnvelopeContent !== 'forbidden' || tool.package?.metadata?.id !== 'dotnet-runic' || !tool.package?.sha256 || !tool.source) fail('tool receipt is not the closed W60-002 consumer shape');
  if (!noPlaceholders(tool)) fail('tool receipt contains placeholder facts');
  return tool;
}

function candidateInventory(set, tool) {
  const platforms = set.platforms.map((platform) => ({ key: `editor/${platform.runtimeIdentifier}`, source: platform.source, sha256: platform.archive?.sha256, size: platform.archive?.size, candidate: { kind: 'editor-platform', runtimeIdentifier: platform.runtimeIdentifier, archive: platform.archive?.path } }));
  const values = [...platforms, { key: 'tool/dotnet-runic', source: tool.source, sha256: tool.package.sha256, size: tool.package.size ?? 0, candidate: { kind: 'dotnet-tool', archive: tool.package.archive } }];
  if (values.some((item) => !item.sha256 || !item.source?.repository || !/^[a-f0-9]{40}$/.test(item.source.revision ?? '') || !/^[a-f0-9]{40}$/.test(item.source.tree ?? '') || !/^[a-f0-9]{64}$/.test(item.sha256))) fail('candidate inventory has malformed source or digest facts');
  if (new Set(values.map((item) => item.key)).size !== values.length) fail('candidate inventory replays a key');
  return values.sort((left, right) => left.key.localeCompare(right.key));
}

function validateAuthority(authority, candidates) {
  if (authority?.schema !== 'runic.authorized-publication-authority/1' || authority.publication !== 'already-authorized-published' || !authority.releaseAuthority?.sha256 || !/^[a-f0-9]{64}$/.test(authority.releaseAuthority.sha256) || !Array.isArray(authority.inventory) || !noPlaceholders(authority)) fail('authority must be an already-authorized published, non-placeholder local input');
  const expected = new Map(candidates.map((item) => [item.key, item]));
  const actual = new Map();
  for (const entry of authority.inventory) {
    if (!entry?.key || actual.has(entry.key)) fail('authority inventory has a replayed key');
    const candidate = expected.get(entry.key);
    if (!candidate) fail('authority inventory has an extra candidate');
    if (!same(entry.candidate, candidate.candidate) || entry.sha256 !== candidate.sha256 || entry.artifact?.sha256 !== candidate.sha256 || entry.artifact?.size !== candidate.size || !sourceEqual(entry.source, candidate.source)) fail('authority inventory does not bind exact candidate source and digest');
    validate('inventory', { schemaVersion: 1, manifest: { sha256: authority.releaseAuthority.sha256 }, artifacts: [entry.artifact] });
    const receipt = entry.receipt;
    validate('receipt', receipt);
    if (!same(receipt.artifact, entry.artifact) || !sourceEqual(receipt.source, candidate.source)) fail('authority receipt does not bind its exact inventory artifact and candidate source');
    actual.set(entry.key, entry);
  }
  if (actual.size !== expected.size || [...expected.keys()].some((key) => !actual.has(key))) fail('authority inventory is missing a candidate');
  return [...actual.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, entry]) => entry);
}

export function verify(candidateReceipt, toolReceipt, authority) {
  const candidate = repeatedCandidate(candidateReceipt);
  const tool = repeatedTool(toolReceipt, candidate);
  const entries = validateAuthority(authority, candidateInventory(candidate, tool));
  return {
    schema,
    result: 'authorized-publication-handoff-compatible',
    inventory: { schemaVersion: 1, manifest: { sha256: authority.releaseAuthority.sha256 }, artifacts: entries.map((entry) => entry.artifact) },
    receipts: entries.map((entry) => entry.receipt),
    transport: { outboundRequests: 0, signaturesIssued: 0, signedMetadataEmitted: 0, releaseMutations: 0, uploads: 0, tags: 0 },
  };
}

export function runTwice(candidateReceipt, toolReceipt, authority) {
  const first = verify(candidateReceipt, toolReceipt, authority), second = verify(candidateReceipt, toolReceipt, authority);
  if (!same(first, second)) fail('local handoff verification is not deterministic');
  return { schema: repeatSchema, journeys: [first, second] };
}

function main(argv) {
  const [command, candidatePath, toolPath, authorityPath, receiptPath] = argv;
  if (command === 'run-twice' && candidatePath && toolPath && authorityPath && !receiptPath) return JSON.stringify(runTwice(json(candidatePath, 'candidate receipt'), json(toolPath, 'tool receipt'), json(authorityPath, 'authorized authority')), null, 2);
  if (command === 'verify-twice' && candidatePath && toolPath && authorityPath && receiptPath) {
    const actual = json(receiptPath, 'handoff receipt'), expected = runTwice(json(candidatePath, 'candidate receipt'), json(toolPath, 'tool receipt'), json(authorityPath, 'authorized authority'));
    if (!same(actual, expected)) fail('handoff receipt differs from the exact local inputs');
    return;
  }
  fail('Usage: authorized-publication-handoff.mjs run-twice <w60-001-receipt> <w60-002-receipt> <already-authorized-published-authority> | verify-twice <w60-001-receipt> <w60-002-receipt> <already-authorized-published-authority> <receipt>');
}

if (import.meta.url === `file://${process.argv[1]}`) { try { const output = main(process.argv.slice(2)); if (output) process.stdout.write(`${output}\n`); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; } }
