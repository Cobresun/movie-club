// The checks `npm run lint` runs after oxlint:
//
// - knip (unused files, exports and dependencies), ratcheted per file against
//   lint/baseline.json like the review/* oxlint rules;
// - the baseline may only shrink relative to the branch point with main;
// - every file the baseline names still exists;
// - a lockfile changes only alongside package.json.
//
// `node lint/check.mjs --write-baseline` (npm run lint:baseline) regenerates
// lint/baseline.json from the current tree.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { BASELINE_FILE, PLUGIN_NAME, ROOT } from "./review-plugin.mjs";

// Keep in step with the `lint` script in package.json.
const LINT_PATHS = ["src", "migrations", "netlify", "lib", "scripts"];
const KNIP_ISSUE_TYPES = [
  "files",
  "dependencies",
  "devDependencies",
  "optionalPeerDependencies",
  "unlisted",
  "binaries",
  "unresolved",
  "exports",
  "types",
  "enumMembers",
  "duplicates",
];

const KNIP_FIXES = {
  files: "delete the file, or import it from where it is used",
  dependencies: "remove it from package.json",
  devDependencies: "remove it from package.json",
  optionalPeerDependencies: "remove it from package.json",
  unlisted: "add the package to package.json, or stop importing it",
  binaries: "add the package that provides the binary to package.json",
  unresolved: "fix the import path",
  exports: "drop the `export`, or delete the code if nothing uses it",
  types: "drop the `export`, or delete the type if nothing uses it",
  enumMembers: "delete the unused member",
  duplicates: "export it once",
};

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  return result;
}

function bin(name) {
  return path.join(ROOT, "node_modules", ".bin", name);
}

function bump(counts, key, file, by = 1) {
  counts[key] ??= {};
  counts[key][file] = (counts[key][file] ?? 0) + by;
}

function lintCounts() {
  const { stdout } = run(bin("oxlint"), ["--format", "json", ...LINT_PATHS], {
    REVIEW_LINT_BASELINE: "off",
  });
  const counts = {};
  const prefix = `${PLUGIN_NAME}(`;
  for (const diagnostic of JSON.parse(stdout).diagnostics) {
    if (diagnostic.code.startsWith(prefix)) {
      bump(
        counts,
        `${PLUGIN_NAME}/${diagnostic.code.slice(prefix.length, -1)}`,
        diagnostic.filename,
      );
    }
  }
  return counts;
}

function knipIssues() {
  const { stdout, stderr, status } = run(bin("knip"), ["--no-progress", "--reporter", "json"]);
  if (stdout.trim() === "") {
    throw new Error(`knip produced no report (exit ${status}):\n${stderr}`);
  }
  const issues = {};
  for (const entry of JSON.parse(stdout).issues) {
    for (const type of KNIP_ISSUE_TYPES) {
      const found = entry[type];
      if (!Array.isArray(found) || found.length === 0) continue;
      issues[`knip/${type}`] ??= {};
      issues[`knip/${type}`][entry.file] = found.map((issue) => issue.name ?? entry.file);
    }
  }
  return issues;
}

function knipCounts(issues) {
  const counts = {};
  for (const [key, files] of Object.entries(issues)) {
    for (const [file, names] of Object.entries(files)) bump(counts, key, file, names.length);
  }
  return counts;
}

function sorted(counts) {
  return Object.fromEntries(
    Object.keys(counts)
      .toSorted()
      .map((key) => [
        key,
        Object.fromEntries(
          Object.keys(counts[key])
            .toSorted()
            .map((file) => [file, counts[key][file]]),
        ),
      ]),
  );
}

function readBaseline() {
  const file = path.join(ROOT, BASELINE_FILE);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

function writeBaseline() {
  const baseline = sorted({ ...lintCounts(), ...knipCounts(knipIssues()) });
  writeFileSync(path.join(ROOT, BASELINE_FILE), `${JSON.stringify(baseline, null, 2)}\n`);
  for (const [key, files] of Object.entries(baseline)) {
    const total = Object.values(files).reduce((sum, count) => sum + count, 0);
    console.log(`${key}: ${total} in ${Object.keys(files).length} files`);
  }
}

function git(args) {
  const { stdout, status } = run("git", args);
  return status === 0 ? stdout : undefined;
}

function baseRef() {
  if (process.env.LINT_BASE_REF) return process.env.LINT_BASE_REF;
  return git(["merge-base", "HEAD", "origin/main"])?.trim();
}

function checkKnip(baseline, errors) {
  const issues = knipIssues();
  const counts = knipCounts(issues);
  const keys = new Set([
    ...Object.keys(counts),
    ...Object.keys(baseline).filter((key) => key.startsWith("knip/")),
  ]);
  for (const key of keys) {
    const type = key.slice("knip/".length);
    const files = new Set([...Object.keys(counts[key] ?? {}), ...Object.keys(baseline[key] ?? {})]);
    for (const file of files) {
      const found = counts[key]?.[file] ?? 0;
      const allowed = baseline[key]?.[file] ?? 0;
      if (found > allowed) {
        const names = issues[key][file].join(", ");
        errors.push(`${file}: ${key} ${names}: ${KNIP_FIXES[type] ?? "remove it"}.`);
      } else if (found < allowed) {
        errors.push(
          `${file}: ${BASELINE_FILE} grandfathers ${allowed} ${key} but there are ${found}; run \`npm run lint:baseline\` to shrink the baseline.`,
        );
      }
    }
  }
}

function checkStale(baseline, errors) {
  for (const [key, files] of Object.entries(baseline)) {
    for (const file of Object.keys(files)) {
      if (!existsSync(path.join(ROOT, file))) {
        errors.push(
          `${BASELINE_FILE} names ${file} under ${key}, which no longer exists; run \`npm run lint:baseline\`.`,
        );
      }
    }
  }
}

function checkAgainstBase(baseline, errors) {
  const base = baseRef();
  if (base === undefined) {
    const message = "lint/check.mjs: no origin/main to compare with (set LINT_BASE_REF)";
    if (process.env.CI) errors.push(`${message}.`);
    else console.warn(`${message}; skipping the baseline-growth and lockfile checks.`);
    return;
  }

  const renamedFrom = {};
  const changed = new Set();
  for (const line of (git(["diff", "--name-status", "-M", base]) ?? "").split("\n")) {
    const [status, first, second] = line.split("\t");
    if (!status || !first) continue;
    changed.add(first);
    if (second) {
      changed.add(second);
      if (status.startsWith("R")) renamedFrom[second] = first;
    }
  }

  const lockfiles = ["package-lock.json", "deno.lock"].filter((file) => changed.has(file));
  const edgeFunctionsChanged = [...changed].some((file) =>
    file.startsWith("netlify/edge-functions/"),
  );
  for (const lockfile of lockfiles) {
    if (changed.has("package.json")) continue;
    if (lockfile === "deno.lock" && edgeFunctionsChanged) continue;
    errors.push(
      `${lockfile} changed but package.json didn't: revert it with \`git checkout ${base.slice(0, 12)} -- ${lockfile}\`.`,
    );
  }

  const baseText = git(["show", `${base}:${BASELINE_FILE}`]);
  if (baseText === undefined) return;
  const before = JSON.parse(baseText);
  for (const [key, files] of Object.entries(baseline)) {
    for (const [file, count] of Object.entries(files)) {
      const previous = before[key]?.[file] ?? before[key]?.[renamedFrom[file]] ?? 0;
      if (count > previous) {
        errors.push(
          `${BASELINE_FILE} grew: ${key} in ${file} went from ${previous} to ${count}. Fix the new violations instead of regenerating the baseline.`,
        );
      }
    }
  }
}

if (process.argv.includes("--write-baseline")) {
  writeBaseline();
} else {
  const baseline = readBaseline();
  const errors = [];
  checkKnip(baseline, errors);
  checkStale(baseline, errors);
  checkAgainstBase(baseline, errors);
  for (const error of errors) console.error(error);
  if (errors.length > 0) process.exit(1);
}
