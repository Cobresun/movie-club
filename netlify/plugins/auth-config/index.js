import { writeFileSync } from "fs";
import path from "path";

/**
 * Type guard to check if string has value (not null/undefined/empty)
 * @param {string | undefined | null} s
 * @returns {s is string}
 */
function hasValue(s) {
  return typeof s === "string" && s.length > 0;
}

/**
 * Writes trusted origins to auth-config.json for Netlify Functions to read at runtime
 * @returns {void}
 */
function writeAuthConfigToFile() {
  const configFilePath = path.join(
    process.cwd(),
    "netlify",
    "functions",
    "utils",
    "auth-config.json",
  );

  // Collect all auth-related environment variables
  const origins = [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.DEPLOY_URL,
    process.env.BETTER_AUTH_URL,
  ].filter(hasValue);

  // Create JSON config file with trustedOrigins array
  const configContent = JSON.stringify(
    {
      trustedOrigins: origins,
    },
    null,
    2,
  );

  writeFileSync(configFilePath, configContent, "utf-8");
}

/**
 * Runs on every build (all contexts: production, deploy-preview, branch-deploy)
 * @returns {Promise<void>}
 */
const onPreBuild = () => {
  try {
    writeAuthConfigToFile();
  } catch (error) {
    console.warn("Warning: Could not write auth config file:", error.message);
    console.warn(
      "Netlify Functions may not have correct trusted origins for authentication",
    );
  }
};

export { onPreBuild };
