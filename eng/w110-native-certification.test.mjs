import assert from "node:assert/strict";
import test from "node:test";
import { trxCounters, verifyHostedRun } from "./w110-native-certification.mjs";

const revision = "a".repeat(40);
const steps = ["Build", "Native parity corpus", "Embedded WebView smoke", "Same-host comparative stress observation", "Upload native parity and raw stress evidence"].map((name) => ({ name, status: "completed", conclusion: "success" }));
function hostedRun() {
  const job = (name, conclusion = "success", selectedSteps = []) => ({ name, status: "completed", conclusion, steps: selectedSteps });
  return {
    schema: "runic.github-actions-native-certification/1",
    repository: "Runic-Artifex/runic-desktop",
    run: { id: 1, url: "https://github.com/Runic-Artifex/runic-desktop/actions/runs/1", event: "workflow_dispatch", workflowName: "CI", status: "completed", conclusion: "success", headSha: revision, createdAt: "now", updatedAt: "later" },
    jobs: [job("Prepare comparative stress baseline"), job("Linux build, test, package, and WebView", "skipped"), job("Native parity and stress (win-x64)", "success", steps), job("Native parity and stress (osx-x64)", "success", steps), job("Native parity and stress (osx-arm64)", "success", steps), job("Verify native evidence matrix")],
  };
}

test("accepts the exact successful hosted native job graph", () => {
  assert.equal(verifyHostedRun(hostedRun(), revision).id, 1);
});

test("rejects missing native phases and source drift", () => {
  const missing = hostedRun();
  missing.jobs.find((item) => item.name.includes("win-x64")).steps.pop();
  assert.throws(() => verifyHostedRun(missing, revision), /win-x64/);
  assert.throws(() => verifyHostedRun(hostedRun(), "b".repeat(40)), /selected Desktop revision/);
});

test("accepts only a complete passing TRX corpus", () => {
  const valid = Buffer.from('<Counters total="58" executed="58" passed="58" failed="0" error="0" timeout="0" aborted="0" notExecuted="0" />');
  assert.equal(trxCounters(valid, "win-x64").passed, 58);
  assert.throws(() => trxCounters(Buffer.from('<Counters total="58" executed="58" passed="57" failed="1" error="0" timeout="0" aborted="0" notExecuted="0" />'), "win-x64"), /complete passing corpus/);
});
