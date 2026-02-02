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

function writeAuthConfigToFile() {
  const configFilePath = path.join(
    process.cwd(),
    "netlify",
    "functions",
    "utils",
    "auth-config.json",
  );

  const origins = new Set(
    [
      process.env.URL,
      process.env.DEPLOY_PRIME_URL,
      process.env.DEPLOY_URL,
      process.env.BETTER_AUTH_URL,
    ].filter(hasValue),
  );

  const configContent = JSON.stringify(
    {
      trustedOrigins: Array.from(origins),
    },
    null,
    2,
  );

  writeFileSync(configFilePath, configContent, "utf-8");
}

const onPreBuild = () => {
  try {
    console.log("Writing auth config file with trusted origins...");
    writeAuthConfigToFile();
  } catch (error) {
    console.warn("Warning: Could not write auth config file:", error.message);
    console.warn(
      "Netlify Functions may not have correct trusted origins for authentication",
    );
  }
};

export { onPreBuild };
