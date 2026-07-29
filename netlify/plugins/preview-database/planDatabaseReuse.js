/**
 * Pure decision logic for the preview-database plugin, kept separate from
 * index.js for two reasons: Netlify validates a plugin entry point's exports
 * against its known event names and rejects anything else, and this is the part
 * worth testing (see planDatabaseReuse.test.js).
 */

/**
 * Migration file name as Kysely records it in `kysely_migration` — the file
 * name without its extension.
 * @param {string} file
 * @returns {string}
 */
export function migrationName(file) {
  return file.replace(/\.ts$/, "");
}

/**
 * Decides whether an existing preview database can be advanced in place instead
 * of dropped and restored from an S3 backup.
 *
 * Reuse is only ever offered when the change is *purely additive*: every
 * migration already applied to this database still hashes to what was applied,
 * and the only difference is migration files that have never run here. The
 * build's `npm run migrate` applies those, and the result is the same schema a
 * fresh restore would have produced.
 *
 * If an already-applied migration's content changed, we rebuild. The tempting
 * alternative — reverse it with `down()` and let the build re-apply it — is not
 * safe, because `down()` is not a reliable inverse of `up()`. It does not have
 * to throw to be wrong: `20260407_ArbitraryClubLists.ts` deletes work lists it
 * cannot represent in the old shape ("a destructive rollback by necessity", per
 * its own comment) and `20260104_ConsolidateUserImage.ts` documents losing OAuth
 * images. Both exit 0, so no error-handling around the rollback could catch
 * them; we would silently preview against a database that no longer matches the
 * migration chain. A drifted schema can also make the re-`up()` fail outright,
 * turning a build that would have passed into one that dies. Rebuilding costs
 * ~100s and is always correct.
 *
 * @param {Object} args
 * @param {Record<string, string>} args.manifest - Current file → hash.
 * @param {Record<string, string> | null} args.cachedManifest - Manifest from the previous build.
 * @param {string[]} args.applied - Applied migration names, oldest first.
 * @returns {{ reuse: false, reason: string } | { reuse: true }}
 */
export function planDatabaseReuse({ manifest, cachedManifest, applied }) {
  if (cachedManifest === null) {
    return { reuse: false, reason: "no cached migration manifest from a previous build" };
  }

  const current = new Map(
    Object.entries(manifest).map(([file, hash]) => [migrationName(file), hash]),
  );
  const cached = new Map(
    Object.entries(cachedManifest).map(([file, hash]) => [migrationName(file), hash]),
  );

  for (const name of applied) {
    if (!current.has(name)) {
      return { reuse: false, reason: `applied migration "${name}" no longer exists locally` };
    }

    if (current.get(name) !== cached.get(name)) {
      return {
        reuse: false,
        reason: `migration "${name}" changed after it was applied here; rebuilding so it runs against a clean schema`,
      };
    }
  }

  // Purely additive: every applied migration is untouched, and anything new is a
  // file that has never run here. The build's `npm run migrate` applies those.
  return { reuse: true };
}
