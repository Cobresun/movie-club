import { describe, expect, it } from "vitest";

import { CLUB_TYPE_CONFIG } from "./common/clubType";
import { USER_SCOPE } from "./common/scope";
import { icons } from "./icons";

// Raw source of every .vue file in the app (Vite glob, eager raw import).
const vueFiles = import.meta.glob<string>("./**/*.vue", {
  query: "?raw",
  import: "default",
  eager: true,
});

// mdi-vue maps a kebab-case name to a `mdiPascalCase` export key.
const toKey = (name: string): string =>
  "mdi" +
  name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

/**
 * Collect every statically-determinable icon name a template references:
 *  - `<mdicon name="kebab">` (static), and quoted literals inside
 *    `<mdicon :name="cond ? 'a' : 'b'">` (dynamic ternaries)
 *  - EmptyState's `action-icon` prop (static and dynamic-literal forms)
 *
 * Names reached only through a computed/ref (e.g. `copyIcon`) are not visible
 * to static analysis and are exempt — keep those in sync manually.
 */
function collectIconNames(source: string): Set<string> {
  const names = new Set<string>();

  for (const [tag] of source.matchAll(/<mdicon\b[\s\S]*?\/?>/g)) {
    const staticName = tag.match(/\bname="([a-z][a-z0-9-]*)"/);
    if (staticName) names.add(staticName[1]);
    const dynamic = tag.match(/:name="([^"]*)"/);
    if (dynamic) {
      for (const literal of ternaryLiterals(dynamic[1])) names.add(literal);
    }
  }

  for (const [, value] of source.matchAll(/\baction-icon="([^"]*)"/g)) {
    if (/^[a-z][a-z0-9-]*$/.test(value)) {
      names.add(value);
    }
    for (const literal of ternaryLiterals(value)) names.add(literal);
  }

  return names;
}

// Quoted kebab literals in ternary-result positions (preceded by `?` or `:`),
// e.g. `cond ? 'icon-a' : 'icon-b'`. Skipping condition operands avoids false
// positives like `getIsSorted() === 'desc'`, where 'desc' is a comparison value.
function ternaryLiterals(expression: string): string[] {
  return [...expression.matchAll(/[?:]\s*'([a-z][a-z0-9-]*)'/g)].map(
    (m) => m[1],
  );
}

describe("mdi icon registration", () => {
  const registered = new Set(Object.keys(icons));

  const usedBy = new Map<string, string[]>();
  for (const [file, source] of Object.entries(vueFiles)) {
    for (const name of collectIconNames(source)) {
      usedBy.set(name, [...(usedBy.get(name) ?? []), file]);
    }
  }

  it("registers every icon referenced in templates", () => {
    const missing = [...usedBy.entries()]
      .filter(([name]) => !registered.has(toKey(name)))
      .map(
        ([name, files]) =>
          `${name} (${toKey(name)}) used in ${files.join(", ")}`,
      );

    expect(
      missing,
      `Unregistered icons — add their mdiPascalCase export to src/icons.ts:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("found a meaningful number of icon references", () => {
    // Guards against the scan silently matching nothing (e.g. a regex regression).
    expect(usedBy.size).toBeGreaterThan(20);
  });

  // Icon names that reach a template only through a function/computed (e.g.
  // `:name="clubTypeIcon(club.type)"`) are invisible to the static scan above.
  // CLUB_TYPE_CONFIG is the registry feeding those dynamic names, so assert its
  // icons are registered here — this is the guard that catches a new club type
  // (or a renamed icon) before it renders mdi-vue's mdiAlert fallback.
  it("registers every CLUB_TYPE_CONFIG icon", () => {
    // Each config contributes its club icon plus dynamic stats icons — all reach
    // templates via computeds, so none are covered by the static scan above.
    const missing = Object.values(CLUB_TYPE_CONFIG)
      .flatMap((config) => [
        { icon: config.icon, clubType: config.clubType },
        { icon: config.stats.countIcon, clubType: config.clubType },
      ])
      .filter((entry) => !registered.has(toKey(entry.icon)))
      .map(
        (entry) =>
          `${entry.icon} (${toKey(entry.icon)}) for ClubType "${entry.clubType}"`,
      );

    expect(
      missing,
      `Unregistered club-type icons — add their mdiPascalCase export to src/icons.ts:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  // The scope registry (USER_SCOPE) feeds icon names to templates through
  // computeds/props too (the space switcher's pinned entry, the diary's solo
  // context chip), so the static scan can't see them. Mirror the CLUB_TYPE
  // guard above for every scope config.
  it("registers every scope-registry icon", () => {
    const scopes = [USER_SCOPE];
    const missing = scopes
      .filter((scope) => !registered.has(toKey(scope.icon)))
      .map(
        (scope) =>
          `${scope.icon} (${toKey(scope.icon)}) for scope "${scope.kind}"`,
      );

    expect(
      missing,
      `Unregistered scope icons — add their mdiPascalCase export to src/icons.ts:\n${missing.join("\n")}`,
    ).toEqual([]);
  });
});
