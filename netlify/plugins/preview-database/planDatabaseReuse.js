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
 * Restoring costs ~100s of build time; re-running a migration costs a second or
 * two. The database is disposable, so the only thing we must protect is
 * *correctness*: the schema afterwards has to match what the PR's migrations
 * describe.
 *
 * In-place is safe when every applied migration whose content changed is one
 * this PR owns (not yet on origin/main) *and* those changed migrations form a
 * contiguous run at the end of the applied list. Then rolling back that run and
 * letting the build's `npm run migrate` re-apply it reproduces the same schema a
 * fresh restore would. Anything else — a changed migration that is already on
 * main, a deleted file, a gap in the middle — we cannot safely unwind, so we
 * rebuild.
 *
 * @param {Object} args
 * @param {Record<string, string>} args.manifest - Current file → hash.
 * @param {Record<string, string> | null} args.cachedManifest - Manifest from the previous build.
 * @param {string[]} args.applied - Applied migration names, oldest first.
 * @param {string[] | null} args.prLocal - Migration files not on origin/main.
 * @returns {{ reuse: false, reason: string } | { reuse: true, rollback: number }}
 */
export function planDatabaseReuse({ manifest, cachedManifest, applied, prLocal }) {
  if (cachedManifest === null) {
    return { reuse: false, reason: "no cached migration manifest from a previous build" };
  }

  if (prLocal === null) {
    return { reuse: false, reason: "could not determine which migrations this PR owns" };
  }

  const prLocalNames = new Set(prLocal.map(migrationName));
  const current = new Map(
    Object.entries(manifest).map(([file, hash]) => [migrationName(file), hash]),
  );
  const cached = new Map(
    Object.entries(cachedManifest).map(([file, hash]) => [migrationName(file), hash]),
  );

  // Indices of applied migrations whose content is no longer what was applied.
  const changed = [];

  for (const [index, name] of applied.entries()) {
    if (!current.has(name)) {
      return { reuse: false, reason: `applied migration "${name}" no longer exists locally` };
    }

    if (current.get(name) === cached.get(name)) {
      continue;
    }

    if (!prLocalNames.has(name)) {
      return {
        reuse: false,
        reason: `migration "${name}" is already on main but its content changed`,
      };
    }

    changed.push(index);
  }

  if (changed.length === 0) {
    // Purely additive: new migration files that were never applied here. The
    // build's `npm run migrate` picks them up with no rollback needed.
    return { reuse: true, rollback: 0 };
  }

  // The changed migrations must be a suffix of the applied list, otherwise
  // rolling back to the earliest one would also unwind untouched migrations
  // that sit after it.
  const first = changed[0];
  const rollback = applied.length - first;

  for (let index = first; index < applied.length; index++) {
    if (!prLocalNames.has(applied[index])) {
      return {
        reuse: false,
        reason: `rolling back to "${applied[first]}" would also unwind "${applied[index]}", which is on main`,
      };
    }
  }

  return { reuse: true, rollback };
}
