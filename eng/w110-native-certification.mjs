#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const journeySchema = "runic.w110-native-certification/1";
export const repeatSchema = "runic.w110-native-certification-repeat/1";
export const zeroActions = { requests: 0, publications: 0, signatures: 0, updates: 0, uploads: 0, releases: 0, tags: 0 };

const revisionPattern = /^[a-f0-9]{40}$/;
const nativeRids = ["win-x64", "osx-x64", "osx-arm64"];
const requiredNativeSteps = ["Build", "Native parity corpus", "Embedded WebView smoke", "Same-host comparative stress observation", "Upload native parity and raw stress evidence"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const fail = (message) => { throw new Error(`W110 native certification: ${message}`); };
const readJson = (path, label) => { try { return JSON.parse(readFileSync(path, "utf8")); } catch { fail(`${label} must be valid JSON`); } };

export function verifyHostedRun(receipt, desktopRevision) {
  if (receipt?.schema !== "runic.github-actions-native-certification/1" || receipt.repository !== "Runic-Artifex/runic-desktop") fail("hosted run identity is invalid");
  const run = receipt.run ?? {};
  if (!Number.isSafeInteger(run.id) || run.id < 1 || run.event !== "workflow_dispatch" || run.workflowName !== "CI" || run.status !== "completed" || run.conclusion !== "success" || run.headSha !== desktopRevision) fail("hosted run is not a successful manual certification of the selected Desktop revision");
  if (run.url !== `https://github.com/Runic-Artifex/runic-desktop/actions/runs/${run.id}`) fail("hosted run URL does not match its identity");
  const jobs = new Map((receipt.jobs ?? []).map((job) => [job.name, job]));
  const expectedNames = ["Prepare comparative stress baseline", "Linux build, test, package, and WebView", ...nativeRids.map((rid) => `Native parity and stress (${rid})`), "Verify native evidence matrix"];
  if (jobs.size !== expectedNames.length || expectedNames.some((name) => !jobs.has(name))) fail("hosted run job set is incomplete or extended");
  if (jobs.get("Prepare comparative stress baseline")?.conclusion !== "success" || jobs.get("Verify native evidence matrix")?.conclusion !== "success" || jobs.get("Linux build, test, package, and WebView")?.conclusion !== "skipped") fail("hosted run job conclusions are invalid");
  for (const rid of nativeRids) {
    const job = jobs.get(`Native parity and stress (${rid})`);
    const steps = new Map((job?.steps ?? []).map((step) => [step.name, step.conclusion]));
    if (job?.conclusion !== "success" || requiredNativeSteps.some((name) => steps.get(name) !== "success")) fail(`${rid} did not pass every required native phase`);
  }
  return { id: run.id, url: run.url, event: run.event, headSha: run.headSha, conclusion: run.conclusion, createdAt: run.createdAt, updatedAt: run.updatedAt };
}

export function trxCounters(bytes, rid) {
  const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
  const match = text.match(/<Counters\s+([^>]+?)\s*\/>/);
  if (!match) fail(`${rid} test results do not contain counters`);
  const counters = Object.fromEntries([...match[1].matchAll(/([A-Za-z]+)="(\d+)"/g)].map((item) => [item[1], Number(item[2])]));
  if (!Number.isSafeInteger(counters.total) || counters.total < 1 || counters.executed !== counters.total || counters.passed !== counters.total || ["failed", "error", "timeout", "aborted", "notExecuted"].some((key) => counters[key] !== 0)) fail(`${rid} test results are not a complete passing corpus`);
  return { total: counters.total, executed: counters.executed, passed: counters.passed, failed: counters.failed, error: counters.error, timeout: counters.timeout, aborted: counters.aborted, notExecuted: counters.notExecuted };
}

export function createJourney({ desktopPath, desktopRevision, evidenceRoot, matrixPath, runPath, toolchain }) {
  if (!revisionPattern.test(desktopRevision)) fail("Desktop revision must be exact");
  try { execFileSync(process.execPath, [join(desktopPath, "eng/comparative-stress/verify-native-matrix.mjs"), "verify", evidenceRoot, matrixPath], { stdio: "pipe" }); }
  catch (error) { fail(`Desktop matrix verification failed: ${String(error.stderr ?? error.message).trim()}`); }
  const matrixBytes = readFileSync(matrixPath);
  const matrix = readJson(matrixPath, "native matrix");
  if (matrix.sources?.runicDesktop !== desktopRevision || matrix.toolchain?.node !== `v${toolchain.node}` || matrix.toolchain?.dotnetSdk !== toolchain.dotnetSdk || !same(matrix.platforms?.map((item) => item.rid), nativeRids)) fail("native matrix drifts from selected source, toolchain, or platform authority");
  const runBytes = readFileSync(runPath);
  const run = verifyHostedRun(readJson(runPath, "hosted run"), desktopRevision);
  const platforms = matrix.platforms.map((platform) => {
    const testPath = join(evidenceRoot, `native-parity-and-stress-${platform.rid}`, "test-results", platform.rid, "test-results.trx");
    const testBytes = readFileSync(testPath);
    return { rid: platform.rid, host: platform.host, stressReceipt: platform.receipt, tests: { path: testPath.slice(evidenceRoot.length + 1), sha256: hash(testBytes), counters: trxCounters(testBytes, platform.rid) } };
  });
  return {
    schema: journeySchema,
    publication: "forbidden",
    externalActions: zeroActions,
    run: { ...run, receiptSha256: hash(runBytes) },
    sources: matrix.sources,
    toolchain: matrix.toolchain,
    workloadSha256: matrix.workloadSha256,
    matrix: { sha256: hash(matrixBytes), interpretation: matrix.interpretation },
    platforms,
  };
}

export function runTwice(input) {
  const journeys = [createJourney(input), createJourney(input)];
  if (!same(journeys[0], journeys[1])) fail("two native evidence constructions differ");
  return { schema: repeatSchema, journeys };
}

export function verifyReceipt(input, receipt) {
  const expected = runTwice(input);
  if (!same(receipt, expected)) fail("retained native certification differs from exact evidence");
  return expected;
}

function options(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index], value = values[index + 1];
    if (!key?.startsWith("--") || !value || result[key]) fail("invalid command line");
    result[key] = value;
  }
  return result;
}

function main(argv) {
  const [command, ...rest] = argv, args = options(rest);
  const required = ["--desktop", "--desktop-revision", "--evidence-root", "--matrix", "--run", "--node", "--dotnet-sdk"];
  if (required.some((key) => !args[key])) fail("required source, toolchain, and evidence inputs are missing");
  const input = { desktopPath: resolve(args["--desktop"]), desktopRevision: args["--desktop-revision"], evidenceRoot: resolve(args["--evidence-root"]), matrixPath: resolve(args["--matrix"]), runPath: resolve(args["--run"]), toolchain: { node: args["--node"], dotnetSdk: args["--dotnet-sdk"] } };
  if (command === "run-twice" && !args["--receipt"]) return JSON.stringify(runTwice(input), null, 2);
  if (command === "verify-twice" && args["--receipt"]) { verifyReceipt(input, readJson(resolve(args["--receipt"]), "native certification")); return; }
  fail("usage: w110-native-certification.mjs run-twice|verify-twice --desktop <repo> --desktop-revision <sha> --evidence-root <dir> --matrix <json> --run <json> --node <version> --dotnet-sdk <version> [--receipt <json>]");
}

if (import.meta.main) { try { const output = main(process.argv.slice(2)); if (output) process.stdout.write(`${output}\n`); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; } }
