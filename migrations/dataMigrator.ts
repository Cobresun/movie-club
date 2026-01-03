import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationName = process.argv[2];

if (!migrationName) {
  console.error(
    "Missing migration name. Usage: npm run migrate:data -- 19700101_MigrateMovies",
  );
  process.exit(1);
}

const scriptPath = path.join(__dirname, "/data", `${migrationName}.ts`);
execSync(`tsx --env-file=.env ${scriptPath}`, { stdio: "inherit" });
