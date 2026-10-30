import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);
const [, , migrationName] = process.argv;

if (!migrationName) {
  console.error("Missing migration name. Usage: npm run migrate:data -- 19700101_MigrateMovies");
  process.exit(1);
}

const scriptPath = path.join(currentDirname, "/data", `${migrationName}.ts`);
execSync(`tsx --env-file=.env ${scriptPath}`, { stdio: "inherit" });
