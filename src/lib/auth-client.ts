import { createAuthClient } from "better-auth/vue";

export const authClient = createAuthClient({
  // No baseURL needed - auth server runs on same domain at /api/auth

  // better-auth captures `fetch` when the module loads; looking it up per call
  // instead lets tests intercept auth requests at the network boundary like any
  // other API call, rather than mocking this module.
  fetchOptions: {
    customFetchImpl: (input, init) => globalThis.fetch(input, init),
  },
});

// Export types for TypeScript support
export type Session = typeof authClient.$Infer.Session;
