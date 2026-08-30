import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJson, verify } from './verify-release-manifest.mjs';

const manifest = loadJson(new URL('../runic.release.json', import.meta.url).pathname);
const schema = loadJson(new URL('../runic.release.schema.json', import.meta.url).pathname);
const clone = () => structuredClone(manifest);
const errorsFor = (change) => { const candidate = clone(); change(candidate); return verify(candidate, schema).join('\n'); };
const lane = (candidate, name = 'current') => candidate.compatibilityTrains[0].lanes.find((item) => item.name === name);
const authority = (candidate, artifact) => candidate.artifactAuthorities.find((item) => item.artifact === artifact);
const evidence = (candidate, artifact) => candidate.formatEvidence.find((item) => item.artifact === artifact);

test('the committed authority inventories only the 19 NuGet and seven npm v1 package identities', () => {
  assert.deepEqual(verify(manifest, schema), []);
  assert.equal(manifest.currentPackages.filter((item) => item.ecosystem === 'nuget').length, 19);
  assert.equal(manifest.currentPackages.filter((item) => item.ecosystem === 'npm').length, 7);
  assert.equal(manifest.canonicalPackages.length, 26);
  assert.deepEqual(Object.fromEntries(['nuget-package', 'dotnet-template', 'dotnet-tool', 'npm-package'].map((kind) => [kind, manifest.canonicalPackages.filter((item) => item.installKind === kind).length])), { 'nuget-package': 15, 'dotnet-template': 2, 'dotnet-tool': 2, 'npm-package': 7 });
  assert.equal(manifest.repositories.length, 13);
  assert.deepEqual(manifest.canonicalPackages.filter((item) => item.identity === '@runic-artifex/angular'), [{ identity: '@runic-artifex/angular', ecosystem: 'npm', installKind: 'npm-package', product: 'application', state: 'approved' }]);
  assert.deepEqual(manifest.currentPackages.filter((item) => item.identity === '@runic-artifex/angular'), [{ identity: '@runic-artifex/angular', ecosystem: 'npm', product: 'application', stableOwner: 'Runic Application', support: 'supported', disposition: 'keep', target: '@runic-artifex/angular', migration: { kind: 'package', target: '@runic-artifex/angular', guidance: 'Keep imports.' } }]);
  assert.equal(authority(manifest, 'asset-manifest'), undefined);
  assert.deepEqual(authority(manifest, 'command-catalog-and-command-io-schema'), {
    artifact: 'command-catalog-and-command-io-schema', product: 'command-line', owner: 'Runic Command Line generator', versioning: 'not-yet-versioned', justification: 'No verified public format version.', evidence: 'command-catalog-and-command-io-schema-evidence'
  });
  assert.deepEqual(authority(manifest, 'desktop-and-lifecycle-contracts'), {
    artifact: 'desktop-and-lifecycle-contracts', product: 'application', owner: 'Runic Application', versioning: 'not-yet-versioned', justification: 'No verified public format version.', evidence: 'desktop-and-lifecycle-contracts-evidence'
  });
  assert.deepEqual(authority(manifest, 'desktop-presentation-contract'), {
    artifact: 'desktop-presentation-contract', product: 'desktop', owner: 'Runic Desktop', versioning: 'versioned', evidence: 'desktop-presentation-contract-evidence'
  });
  assert.deepEqual(manifest.products.filter((item) => item.documentation.state === 'pending').map((item) => item.id), ['svelte', 'vite']);
  assert.equal(manifest.products.find((item) => item.id === 'desktop').documentation.path, '/products/runic-desktop/');
  assert.equal(manifest.products.find((item) => item.id === 'application').documentation.path, '/products/runic-toolkit/');
  assert.equal(manifest.products.find((item) => item.id === 'release-automation').documentation.path, '/releases/');
  for (const artifact of ['translation-catalog-manifest', 'translation-resource-document']) {
    const claim = manifest.formatSupport.find((item) => item.artifact === artifact);
    assert.deepEqual(claim.writer, { state: 'published', value: '2' });
    assert.deepEqual(claim.readerSupport, [1, 2]);
  }
});
test('valid many-to-one package merges remain valid', () => assert.deepEqual(verify(clone(), schema), []));
test('schema failures, missing dispositions, and unsupported schema keywords or forms fail closed', () => {
  assert.match(errorsFor((item) => { item.schemaVersion = 2; }), /schemaVersion/);
  assert.match(errorsFor((item) => { delete item.currentPackages[0].disposition; }), /disposition.*required/);
  assert.match(errorsFor((item) => { item.artifactAuthorities = item.artifactAuthorities.slice(0, 14); }), /artifactAuthorities: must contain at least 15 item/);
  assert.match(errorsFor((item) => { item.formatEvidence = item.formatEvidence.slice(0, 14); }), /formatEvidence: must contain at least 15 item/);
  const altered = structuredClone(schema); altered.patternProperties = {}; assert.match(verify(manifest, altered).join('\n'), /unsupported JSON Schema keyword/);
  const objectAdditionalProperties = structuredClone(schema); objectAdditionalProperties.$defs.product.additionalProperties = { type: 'string' }; assert.match(verify(manifest, objectAdditionalProperties).join('\n'), /additionalProperties: only false is supported/);
  const booleanItems = structuredClone(schema); booleanItems.properties.products.items = false; assert.match(verify(manifest, booleanItems).join('\n'), /items: only one object schema is supported/);
  const referenceSibling = structuredClone(schema); referenceSibling.$defs.product.properties.id.type = 'string'; assert.match(verify(manifest, referenceSibling).join('\n'), /\$ref: sibling keywords are not supported/);
  const unionSibling = structuredClone(schema); unionSibling.$defs.nullableVersion.type = 'array'; assert.match(verify(manifest, unionSibling).join('\n'), /anyOf: sibling keywords are not supported/);
  const malformedMinimum = structuredClone(schema); malformedMinimum.$defs.id.minLength = 'not-a-number'; assert.match(verify({ ...manifest, artifactAuthorities: manifest.artifactAuthorities.map((item, index) => index ? item : { ...item, owner: '' }) }, malformedMinimum).join('\n'), /minLength: must be a non-negative integer/);
  assert.match(errorsFor((item) => { item.$schema = 'https://example.invalid/other.schema.json'; }), /\$schema/);
});
test('ecosystem-normalized package duplicates and unknown package references are rejected', () => {
  assert.match(errorsFor((item) => { item.currentPackages[1].identity = item.currentPackages[0].identity.toLowerCase(); }), /duplicate identifier/);
  assert.match(errorsFor((item) => { item.currentPackages.at(-1).identity = '@runic-artifex/svelte'; }), /duplicate identifier/);
  assert.match(errorsFor((item) => { item.canonicalPackages[0].installKind = 'dotnet-tool'; }), /installKind/);
  assert.match(errorsFor((item) => { item.currentPackages[0].product = 'missing'; item.currentPackages[0].target = 'missing'; item.currentPackages[0].migration.target = 'missing'; }), /unknown product.*unknown canonical target.*migration.target: unknown canonical target/s);
});
test('invalid migration, conflicting authority, invalid version pair, and archived Flow lane membership are rejected', () => {
  assert.match(errorsFor((item) => { item.currentPackages[0].migration.target = 'missing'; }), /migration.target: unknown canonical target/);
  assert.match(errorsFor((item) => { item.artifactAuthorities.push({ ...item.artifactAuthorities[0] }); }), /duplicate identifier/);
  assert.match(errorsFor((item) => { lane(item).versions[0].version.value = '0.2.0'; }), /unassigned versions must have a null value/);
  assert.match(errorsFor((item) => { lane(item).versions[0].version = { state: 'published', value: '0.2' }; }), /must match/);
  assert.match(errorsFor((item) => { lane(item, 'next-candidate').products.push('flow'); lane(item, 'next-candidate').versions.push({ product: 'flow', version: { state: 'unassigned', value: null } }); }), /archived Flow must not appear/);
});
test('duplicated package ownership, migration, evidence ownership, and distribution data stay aligned', () => {
  assert.match(errorsFor((item) => { item.currentPackages[0].support = 'archived'; }), /support: must match product support/);
  assert.match(errorsFor((item) => { item.currentPackages[0].migration.target = 'Runic.Application.Bridge'; }), /migration.target: must match disposition target/);
  assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').repository = 'translations'; }), /must match owning product repository 'application'/);
  assert.match(errorsFor((item) => { item.distributions.find((entry) => entry.id === 'translations-editor-archive').product = 'application'; }), /does not match its approved product, kind, and identity/);
});
test('duplicate product, duplicate distribution, and unknown distribution product are rejected', () => {
  assert.match(errorsFor((item) => { item.products.push({ ...item.products[0] }); }), /products.*duplicate identifier/);
  assert.match(errorsFor((item) => { item.distributions.push({ ...item.distributions[0] }); }), /distributions.*duplicate identifier/);
  assert.match(errorsFor((item) => { item.distributions[0].product = 'missing'; }), /distributions.*unknown product/);
});
test('unknown authority product, orphan support and evidence, and dangling authority are rejected', () => {
  assert.match(errorsFor((item) => { item.artifactAuthorities[0].product = 'missing'; }), /artifactAuthorities.*unknown product/);
  assert.match(errorsFor((item) => { item.formatSupport[0].artifact = 'orphan'; }), /orphan format-support artifact/);
  assert.match(errorsFor((item) => { item.formatEvidence[0].artifact = 'orphan'; }), /orphan format evidence/);
  assert.match(errorsFor((item) => { item.formatSupport = item.formatSupport.filter((entry) => entry.artifact !== 'bridge-contract'); }), /dangling versioned authority 'bridge-contract'/);
});
test('ADR 0017 and Desktop presentation authority assignments are required', () => {
  assert.match(errorsFor((item) => { item.artifactAuthorities = item.artifactAuthorities.filter((entry) => entry.artifact !== 'command-catalog-and-command-io-schema'); item.artifactAuthorities.push({ artifact: 'unrelated-authority', product: 'application', owner: 'Unrelated', versioning: 'not-yet-versioned', justification: 'No verified public format version.', evidence: 'unrelated-authority-evidence' }); }), /missing required authority 'command-catalog-and-command-io-schema'/);
  assert.match(errorsFor((item) => { authority(item, 'desktop-and-lifecycle-contracts').product = 'command-line'; }), /incorrect ADR 0017 authority assignment/);
  assert.match(errorsFor((item) => { authority(item, 'desktop-presentation-contract').product = 'application'; }), /incorrect ADR 0017 authority assignment/);
  assert.match(errorsFor((item) => { authority(item, 'command-catalog-and-command-io-schema').versioning = 'versioned'; delete authority(item, 'command-catalog-and-command-io-schema').justification; item.formatSupport.push({ artifact: 'command-catalog-and-command-io-schema', writer: { state: 'published', value: '1' }, readerSupport: [1], evidence: 'command-catalog-and-command-io-schema-evidence' }); }), /incorrect ADR 0017 authority assignment/);
});
test('compatibility lanes require registered products and exactly one version per member', () => {
  assert.match(errorsFor((item) => { lane(item, 'previous-supported').name = 'current'; }), /missing required compatibility lane 'previous-supported'/);
  assert.match(errorsFor((item) => { lane(item).versions = lane(item).versions.slice(1); }), /missing lane version for 'application'/);
  assert.match(errorsFor((item) => { lane(item).versions.push(structuredClone(lane(item).versions[0])); }), /duplicate lane version 'application'/);
  assert.match(errorsFor((item) => { lane(item).versions.push({ product: 'flow', version: { state: 'unassigned', value: null } }); }), /extra lane version 'flow'/);
  assert.match(errorsFor((item) => { lane(item).products.push('missing-product'); lane(item).versions.push({ product: 'missing-product', version: { state: 'unassigned', value: null } }); }), /unknown lane product 'missing-product'/);
  assert.match(errorsFor((item) => { lane(item).products.push('flow'); lane(item).versions.push({ product: 'flow', version: { state: 'unassigned', value: null } }); }), /does not belong in the current lane/);
  assert.match(errorsFor((item) => { lane(item).products = lane(item).products.filter((id) => id !== 'application'); lane(item).versions = lane(item).versions.filter((entry) => entry.product !== 'application'); }), /missing required current product 'application'/);
});
test('Flow is an immutable archive decision with no publication identities, compatibility lane, or relabel escape', () => {
  assert.match(errorsFor((item) => { delete item.products.find((entry) => entry.id === 'flow').archive; }), /immutable archived Flow decision/);
  assert.match(errorsFor((item) => { item.products.find((entry) => entry.id === 'flow').archive.evidence.revision = 'a'.repeat(40); }), /immutable archived Flow decision/);
  assert.match(errorsFor((item) => { item.canonicalPackages.push({ identity: 'Runic.Operations', ecosystem: 'nuget', installKind: 'nuget-package', product: 'flow', state: 'approved' }); }), /archived Flow identities are reserved and must not be publishable/);
  assert.match(errorsFor((item) => { item.currentPackages[0].identity = 'RunicFlow'; }), /archived Flow identities are historical|retired identity/);
  assert.match(errorsFor((item) => { item.compatibilityTrains[0].lanes.push({ name: 'experimental', products: [], versions: [] }); }), /must be one of/);
  for (const identity of ['RunicFlow', 'RunicFlow.ApplicationBridge', 'Runic.Operations', 'Runic.Operations.ApplicationBridge']) {
    assert.match(errorsFor((item) => { item.canonicalPackages.push({ identity, ecosystem: 'nuget', installKind: 'nuget-package', product: 'application', state: 'approved' }); }), /archived Flow identities are reserved and must not be publishable/);
    assert.match(errorsFor((item) => { const entry = item.currentPackages[0]; entry.identity = identity; entry.product = 'application'; entry.stableOwner = 'Runic Application'; entry.support = 'supported'; entry.disposition = 'keep'; entry.target = 'Runic.Application'; entry.migration = { kind: 'package', target: 'Runic.Application', guidance: 'Keep imports.' }; }), /archived Flow identities are historical|retired identity/);
  }
  for (const identity of ['runicflow', 'RUNiCFLOW.APPLICATIONBRIDGE', 'runic.operations', 'RUNiC.OPERATIONS.APPLICATIONBRIDGE']) {
    assert.match(errorsFor((item) => { item.canonicalPackages.push({ identity, ecosystem: 'nuget', installKind: 'nuget-package', product: 'application', state: 'approved' }); }), /archived Flow identities are reserved and must not be publishable/);
    assert.match(errorsFor((item) => { const entry = item.currentPackages[0]; entry.identity = identity; entry.product = 'application'; entry.stableOwner = 'Runic Application'; entry.support = 'supported'; entry.disposition = 'keep'; entry.target = 'Runic.Application'; entry.migration = { kind: 'package', target: 'Runic.Application', guidance: 'Keep imports.' }; }), /archived Flow identities are historical|retired identity/);
  }
});
test('the required repository registry and target identities are authoritative', () => {
  for (const id of ['application', 'desktop', 'examples', 'release-automation']) assert.match(errorsFor((item) => { item.repositories = item.repositories.filter((entry) => entry.id !== id); item.repositories.push({ ...item.repositories[0], id: 'unrelated', currentIdentity: 'unrelated', v02Identity: 'unrelated' }); }), new RegExp(`missing required repository '${id}'`));
  assert.match(errorsFor((item) => { item.repositories.find((entry) => entry.id === 'application').v02Identity = 'wrong'; }), /incorrect target repository identity/);
});
test('versioned format claims require complete, linked, verified, matching evidence', () => {
  assert.match(errorsFor((item) => { authority(item, 'bridge-contract').evidence = 'missing'; }), /has no matching format evidence/);
  assert.match(errorsFor((item) => { const entry = evidence(item, 'bridge-contract'); entry.state = 'unverified'; entry.writer = null; entry.readerSupport = null; entry.repository = null; entry.sources = null; entry.verification = null; }), /bridge-contract.*requires verified format evidence/);
  assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').sources = []; }), /verified evidence.*incomplete/);
  assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').verification.command = ''; }), /verified evidence.*incomplete/);
  assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').writer.value = '2'; }), /must exactly match verified evidence claims/);
  assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').readerSupport = [2]; }), /must exactly match verified evidence claims/);
  assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').sources = [{ path: 'generated/bridge.manifest.json', role: 'generated' }]; }), /generated output is not authored evidence/);
});
test('format evidence closes nested objects and accepts valid replacements for null branches', () => {
  assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').writer.extra = true; }), /formatEvidence\[1\]\.writer\.extra: additional properties are not allowed/);
  assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').verification.extra = true; }), /formatEvidence\[1\]\.verification\.extra: additional properties are not allowed/);
  assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').sources[0].extra = true; }), /formatEvidence\[1\]\.sources\[0\]\.extra: additional properties are not allowed/);
  assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').writer = []; }), /formatEvidence\[1\]\.writer: must match at least one schema/);
  assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').verification = []; }), /formatEvidence\[1\]\.verification: must match at least one schema/);
  assert.match(errorsFor((item) => { item.formatSupport[0].writer = null; }), /formatSupport\[0\]\.writer: must be object/);
  const candidate = clone();
  const unverified = evidence(candidate, 'application-composition-manifest');
  unverified.writer = { state: 'published', value: '1' };
  unverified.readerSupport = [1];
  unverified.repository = 'application';
  unverified.sources = [{ path: 'protocol/composition/contract.mjs', role: 'producer' }];
  unverified.verification = { method: 'source-inspection', command: 'rg -n -F formatVersion protocol/composition/contract.mjs' };
  assert.deepEqual(verify(candidate, schema), ["formatEvidence[0]: unverified evidence for 'application-composition-manifest' must not make format claims"]);
});
test('format evidence rejects generated output path segments without rejecting harmless substrings', () => {
  for (const path of ['GENERATED/bridge.manifest.json', 'protocol/Dist/bridge.manifest.json', 'nested/BUILD/file', 'nested\\bin\\file', 'protocol/obj/file']) assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').sources = [{ path, role: 'specification' }]; }), /generated output is not authored evidence/);
  for (const path of ['generated-contract/bridge.manifest.json', 'protocol/distillery/bridge.manifest.json', 'nested/builds/file', 'nested/binary/file', 'protocol/object/file']) assert.deepEqual(verify((() => { const candidate = clone(); evidence(candidate, 'bridge-contract').sources = [{ path, role: 'specification' }]; return candidate; })(), schema), []);
  for (const path of ['/tmp/contract.mjs', '../outside/contract.mjs', 'src/../../outside/contract.mjs', 'C:\\temp\\contract.mjs', 'C:temp\\contract.mjs', 'https://example.invalid/source.cs', 'file:///tmp/source.cs', '.']) assert.match(errorsFor((item) => { evidence(item, 'bridge-contract').sources = [{ path, role: 'producer' }]; }), /must be repository-relative/);
});
test('bridge evidence cites authored producers, generatorFormatVersion consumer guard, and regeneration', () => {
  const bridge = evidence(manifest, 'bridge-contract');
  assert.deepEqual(bridge.sources, [
    { path: 'protocol/application-bridge/setup/contract.mjs', role: 'producer' },
    { path: 'protocol/application-bridge/counter/contract.mjs', role: 'producer' },
    { path: 'src/Runic.Application.Bridge.Generators/ApplicationBridgeGenerator.cs', role: 'consumer' }
  ]);
  assert.equal(bridge.verification.command, "node --input-type=module -e \"for (const path of ['./protocol/application-bridge/setup/contract.mjs', './protocol/application-bridge/counter/contract.mjs']) { const { default: contract } = await import(path); if (contract.formatVersion !== 1) process.exitCode = 1; console.log(path + ' formatVersion=' + contract.formatVersion); }\" && rg -n -F 'root.GetProperty(\"generatorFormatVersion\").GetInt32() != 1' src/Runic.Application.Bridge.Generators/ApplicationBridgeGenerator.cs && node eng/generate-application-bridge-contract.mjs --check");
});
test('coordinated unsupported Svelte and Vite promotions fail closed', () => {
  for (const [artifact, writer, readerSupport] of [['svelte-projection', '2', [2]], ['vite-diagnostics', '1', [1]]]) {
    assert.match(errorsFor((item) => { const declared = authority(item, artifact); declared.versioning = 'versioned'; delete declared.justification; item.formatSupport.push({ artifact, writer: { state: 'published', value: writer }, readerSupport, evidence: declared.evidence }); }), new RegExp(`versioned authority '${artifact}' requires verified format evidence`));
  }
});
