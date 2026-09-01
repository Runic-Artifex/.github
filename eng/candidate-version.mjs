const CORE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FULL_REVISION = /^[0-9a-f]{40}$/;

export function candidateVersion(baseVersion, revision, revisionLength = 16) {
  if (!CORE_VERSION.test(baseVersion)) {
    throw new Error(`base version must be a SemVer core version: ${baseVersion}`);
  }

  if (!FULL_REVISION.test(revision)) {
    throw new Error("revision must be a lowercase 40-character Git SHA");
  }

  if (!Number.isInteger(revisionLength) || revisionLength < 12 || revisionLength > 40) {
    throw new Error("revision length must be an integer between 12 and 40");
  }

  return `${baseVersion}-ci.sha${revision.slice(0, revisionLength)}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , baseVersion, revision, revisionLength] = process.argv;
  process.stdout.write(
    `${candidateVersion(baseVersion, revision, revisionLength === undefined ? 16 : Number(revisionLength))}\n`
  );
}
