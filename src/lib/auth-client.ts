import { createAuthClient } from "better-auth/vue";

export const authClient = createAuthClient({
  // No baseURL needed - auth server runs on same domain at /api/auth
});

// Export types for TypeScript support
export type Session = typeof authClient.$Infer.Session;
