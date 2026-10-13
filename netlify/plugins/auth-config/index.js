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
  const configFilePath = path.join(process.cwd(), "auth-config.json");

  const origins = new Set(
    [
      process.env.URL,
      process.env.DEPLOY_PRIME_URL,
      process.env.DEPLOY_URL,
      process.env.BETTER_AUTH_URL,
    ].filter(hasValue),
  );

  // The URL this particular deploy answers on: the site URL in production, the
  // per-PR one on a deploy preview. BetterAuth's emailed links are built from
  // BETTER_AUTH_URL (pinned to production for Google OAuth), so the functions
  // need this to point password-reset and verification links back at the deploy
  // whose database actually holds the token.
  const siteURL = [
    process.env.DEPLOY_PRIME_URL,
    process.env.URL,
    process.env.BETTER_AUTH_URL,
  ].find(hasValue);

  const configContent = JSON.stringify(
    {
      siteURL,
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
