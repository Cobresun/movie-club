# Deploy Preview Authentication Bug - Investigation Summary

## The Bug

Deploy previews are getting 403 INVALID_ORIGIN errors when attempting to use auth endpoints (specifically sign-out):

```
POST https://deploy-preview-229--cobresun-movie-club.netlify.app/api/auth/sign-out
403 {"code":"INVALID_ORIGIN","message":"Invalid origin"}
```

## Timeline of Fix Attempts

### Original Issue (Commit 8986eea)

The auth configuration had overly permissive security:

```typescript
trustedOrigins: (req) => {
  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const configuredOrigins = [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.BETTER_AUTH_URL,
  ].filter(isDefined);

  const trusted = [...configuredOrigins];

  // SECURITY ISSUE: Trusted ALL *.netlify.app domains and ALL localhost ports
  if (
    origin.startsWith("http://localhost:") ||
    origin.endsWith(".netlify.app")
  ) {
    trusted.push(origin);
  }

  return trusted;
}
```

**Problem**: This allowed ANY Netlify app or ANY localhost application to access auth endpoints.

### Fix Attempt #1 (Commit 726503f - "another attempt")

Tried to fix security by switching to a static array:

```typescript
trustedOrigins: [
  process.env.URL,
  process.env.DEPLOY_PRIME_URL,
  process.env.BETTER_AUTH_URL,
].filter(isDefined)
```

**Result**: Deploy previews broke with 403 INVALID_ORIGIN errors.

**Hypothesis at the time**: `DEPLOY_PRIME_URL` is only available at build time, not at runtime in Netlify Functions.

### Fix Attempt #2 (Commit ad0c4be - "Trying again")

Implemented site-specific pattern matching:

```typescript
function extractSiteFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(".netlify.app", "");
  } catch {
    return "";
  }
}

trustedOrigins: async (request) => {
  if (!request) {
    return [process.env.URL, process.env.BETTER_AUTH_URL].filter(isDefined);
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (!requestOrigin) {
    return [process.env.URL, process.env.BETTER_AUTH_URL].filter(isDefined);
  }

  // Build base trusted origins - MISSING DEPLOY_PRIME_URL!
  const trusted = [
    process.env.URL,
    process.env.BETTER_AUTH_URL,
  ].filter(isDefined);

  // Validate against our specific site pattern
  const siteIdentifier = extractSiteFromUrl(process.env.URL);
  if (
    requestOrigin.includes(`${siteIdentifier}.netlify.app`) ||
    requestOrigin.startsWith("http://localhost:")
  ) {
    trusted.push(requestOrigin);
  }

  return trusted;
}
```

**Result**: Still broken with 403 INVALID_ORIGIN errors.

**Bugs identified**:
1. `DEPLOY_PRIME_URL` was not included in the base trusted origins array
2. Relied on string matching to add deploy preview URL, which is fragile
3. If `process.env.URL` is a custom domain (not *.netlify.app), pattern matching would fail completely

### Fix Attempt #3 (Latest - current HEAD)

Added `DEPLOY_PRIME_URL` to base origins and improved pattern matching:

```typescript
function extractNetlifySiteFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    if (!hostname.endsWith(".netlify.app")) {
      return null; // Not a Netlify URL (custom domain)
    }
    return hostname.replace(".netlify.app", "");
  } catch {
    return null;
  }
}

trustedOrigins: async (request) => {
  // Base trusted origins - ALWAYS include DEPLOY_PRIME_URL!
  const baseOrigins = [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,  // ← ADDED
    process.env.BETTER_AUTH_URL,
  ].filter(isDefined);

  if (!request) {
    return baseOrigins;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (!requestOrigin) {
    return baseOrigins;
  }

  const trusted = [...baseOrigins];

  // Always trust localhost for development
  if (requestOrigin.startsWith("http://localhost:")) {
    if (!trusted.includes(requestOrigin)) {
      trusted.push(requestOrigin);
    }
    return trusted;
  }

  // Extract Netlify site identifier (if URL is a Netlify URL)
  const siteIdentifier = extractNetlifySiteFromUrl(process.env.URL);

  // If we have a site identifier, validate that the request origin matches our site
  if (siteIdentifier && requestOrigin.includes(`${siteIdentifier}.netlify.app`)) {
    if (!trusted.includes(requestOrigin)) {
      trusted.push(requestOrigin);
    }
  }

  return trusted;
}
```

**Result**: STILL BROKEN with 403 INVALID_ORIGIN errors.

## Key Findings from Investigation

### BetterAuth API

From BetterAuth v1.4.7 type definitions:

```typescript
trustedOrigins?: (string[] | ((request: Request) => string[] | Promise<string[]>)) | undefined;
```

- Can be static array OR dynamic function
- Function receives `Request` parameter
- **CRITICAL**: Request parameter is `undefined` during initialization and `auth.api` calls
- Supports wildcard patterns (`*`, `**`), but has documented reliability issues

### Netlify Environment Variables

**Available during build AND runtime:**
- `URL` - Main production site address (e.g., `https://cobresun-movie-club.netlify.app`)
- `CONTEXT` - Deploy context: `production`, `deploy-preview`, `branch-deploy`, or `dev`

**Build-time ONLY (NOT available at runtime in functions):**
- `DEPLOY_PRIME_URL` - Primary URL for the deploy/group
- `DEPLOY_URL` - Unique URL for individual deploy

**Critical Issue**: The investigation found conflicting information about whether `DEPLOY_PRIME_URL` is available at runtime. Some sources say build-time only, but our code attempts to use it at runtime.

### The Core Mystery

**Why is this still broken?**

Possible explanations:

1. **`DEPLOY_PRIME_URL` is truly unavailable at runtime**
   - If `DEPLOY_PRIME_URL` is `undefined` when functions execute, it gets filtered out
   - We're back to relying on pattern matching, which may be failing

2. **Pattern matching is failing**
   - `process.env.URL` might not be what we expect in deploy previews
   - The site identifier extraction might be incorrect
   - The `includes()` check might not match the actual deploy preview URL format

3. **BetterAuth is caching the configuration**
   - The `betterAuth()` configuration is evaluated at module load time
   - Changes might not take effect without a fresh deploy
   - The function might be getting stale configuration

4. **Origin header mismatch**
   - The actual `origin` header from the browser might not match what we expect
   - Could be protocol issues (http vs https)
   - Could be port issues

5. **BetterAuth internal logic**
   - BetterAuth might be doing additional origin validation beyond what we configure
   - The async function might not be properly awaited
   - There might be other configuration options affecting origin validation

## What We Know

✅ The 403 error is definitely coming from BetterAuth's origin validation
✅ Production URL and localhost work fine
✅ Deploy previews consistently fail
✅ `trustedOrigins` can be either static array or dynamic function
✅ The site identifier is `cobresun-movie-club` (from production URL)
✅ Deploy preview URL format is: `https://deploy-preview-229--cobresun-movie-club.netlify.app`

## What We Don't Know

❓ What is the actual value of `process.env.URL` in deploy preview context?
❓ What is the actual value of `process.env.DEPLOY_PRIME_URL` in deploy preview context (is it undefined)?
❓ What is the actual `origin` header being sent by the browser?
❓ What does BetterAuth's `trustedOrigins` function actually receive and return?
❓ Is there a caching issue preventing new configuration from taking effect?

## Debugging Steps Needed

1. **Add logging to the trustedOrigins function**
   ```typescript
   trustedOrigins: async (request) => {
     console.log('=== TRUSTED ORIGINS DEBUG ===');
     console.log('URL:', process.env.URL);
     console.log('DEPLOY_PRIME_URL:', process.env.DEPLOY_PRIME_URL);
     console.log('BETTER_AUTH_URL:', process.env.BETTER_AUTH_URL);
     console.log('Request defined:', !!request);
     if (request) {
       console.log('Origin header:', request.headers.get('origin'));
       console.log('Referer header:', request.headers.get('referer'));
     }

     const result = // ... your logic
     console.log('Returning trusted origins:', result);
     return result;
   }
   ```

2. **Verify environment variables in deploy preview**
   - Create a debug endpoint that returns all env variables
   - Check what's actually set in the deploy preview context

3. **Test with wildcard pattern temporarily**
   - Try `trustedOrigins: ["https://*.netlify.app"]` to see if it works
   - This would confirm the issue is with our pattern matching logic
   - (Don't leave this in production - it's the original security issue)

4. **Check BetterAuth configuration options**
   - Look for other options that might affect CORS/origin validation
   - Check if there's a `cors` configuration option
   - Review BetterAuth documentation for deploy preview examples

5. **Simplify the logic**
   - Try the absolute simplest version:
   ```typescript
   trustedOrigins: [
     "https://cobresun-movie-club.netlify.app",
     "https://deploy-preview-229--cobresun-movie-club.netlify.app",
     "http://localhost:8888",
   ]
   ```
   - If this works, we know the issue is with dynamic logic
   - If this doesn't work, the problem is elsewhere (BetterAuth config, CORS headers, etc.)

## Files Involved

- `/Users/bnor/code/movie-club/web/netlify/functions/utils/auth.ts` - Auth configuration
- `/Users/bnor/code/movie-club/web/netlify/functions/auth.ts` - Auth handler (just passes through to BetterAuth)
- `/Users/bnor/code/movie-club/web/src/lib/auth-client.ts` - Frontend auth client
- `/Users/bnor/code/movie-club/web/netlify.toml` - Netlify configuration
- `/Users/bnor/code/movie-club/web/package.json` - Dependencies (better-auth@1.4.7)

## Repository Context

- Working directory: `/Users/bnor/code/movie-club/web`
- Branch: `bnor/update-functions`
- Main branch: `main`
- Deploy preview: `https://deploy-preview-229--cobresun-movie-club.netlify.app`
- Production: `https://cobresun-movie-club.netlify.app` (assumed)

## Related Documentation

- BetterAuth Security Reference: https://www.better-auth.com/docs/reference/security
- BetterAuth Options: https://www.better-auth.com/docs/reference/options
- Netlify Environment Variables: https://docs.netlify.com/build/configure-builds/environment-variables/
- Netlify Functions Environment: https://docs.netlify.com/build/functions/environment-variables/

## Recommendation for Next Agent

The most likely issue is that we still don't fully understand what environment variables are actually available at runtime in deploy preview functions. The first priority should be **adding comprehensive logging** to see exactly what values are present and what BetterAuth is receiving/returning.

A quick sanity check would be to temporarily use a hardcoded static array with the specific deploy preview URL to rule out whether the issue is with dynamic logic vs. something else entirely.
