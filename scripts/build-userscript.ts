/**
 * Concatenates the Tampermonkey metadata header onto the shared content
 * script to produce extension/movie-club.user.js. The generated file is
 * checked in so it can be installed straight from the repo's raw URL.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const extensionDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "extension",
);

const header = readFileSync(
  join(extensionDir, "userscript-header.txt"),
  "utf8",
);
const body = readFileSync(join(extensionDir, "content.js"), "utf8");

writeFileSync(join(extensionDir, "movie-club.user.js"), `${header}\n${body}`);
console.log("Wrote extension/movie-club.user.js");
