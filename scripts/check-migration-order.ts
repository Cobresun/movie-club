#!/usr/bin/env tsx

import { execSync } from "child_process";
import path from "path";

import { hasElements, hasValue } from "../lib/checks/checks.js";

/**
 * Migrator names (filename without extension) added relative to main that sort
 * at or before main's newest migration. Kysely refuses to migrate when a new
 * name sorts before one it has already executed, and production has executed
 * everything on main.
 */
export function findOutOfOrderMigrations(onMain: string[], onBranch: string[]): string[] {
  const newest = onMain.toSorted().at(-1);
  if (newest === undefined) {
    return [];
  }

  const existing = new Set(onMain);
  return onBranch.filter((name) => !existing.has(name) && name <= newest).toSorted();
}

export function formatOutOfOrderError(outOfOrder: string[], onMain: string[]): string {
  return [
    `These migrations sort at or before ${onMain.toSorted().at(-1)}, the newest on origin/main:`,
    ...outOfOrder.map((name) => `  - ${name}`),
    "",
    "Kysely refuses to migrate out of order, so merging this would break every production deploy.",
    "Rename the file to a later date (migrations run in filename order).",
  ].join("\n");
}

function listMigrations(ref: string): string[] {
  return execSync(`git ls-tree -r --name-only ${ref} -- migrations/schema`, {
    encoding: "utf-8",
    stdio: "pipe",
  })
    .split("\n")
    .map((line) => path.parse(line.trim()).name)
    .filter(hasValue);
}

function main() {
  const onMain = listMigrations("origin/main");
  const outOfOrder = findOutOfOrderMigrations(onMain, listMigrations("HEAD"));

  if (hasElements(outOfOrder)) {
    console.error(formatOutOfOrderError(outOfOrder, onMain));
    process.exit(1);
  }

  console.log("Migration order OK");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
