/**
 * Scope registry — the "My Library" user scope introduced by Solo Spaces (M1).
 *
 * M1 adds a single non-club scope alongside clubs. The full generalization —
 * driving the existing club views off a shared ScopeConfig so that
 * `/club/:clubSlug/*` and `/me/*` render from one scope-parameterized view
 * tree — is deliberately deferred to M2+. This file therefore carries only the
 * fields the M1 "My Library" surface actually reads; no speculative fields.
 */
export type ScopeKind = "club" | "user";

export interface ScopeConfig {
  readonly kind: ScopeKind;
  /** Display label (switcher entry, page header). */
  readonly label: string;
  /** Material Design Icon name — must be registered in `src/icons.ts`. */
  readonly icon: string;
  /** Named route for the scope's home view. */
  readonly homeRoute: string;
  /** API path prefix for the scope's endpoints. */
  readonly apiBase: string;
}

export const USER_SCOPE: ScopeConfig = {
  kind: "user",
  label: "My Library",
  icon: "bookshelf",
  homeRoute: "MyLibrary",
  apiBase: "/api/me",
};
