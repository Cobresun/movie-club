/**
 * Ownership scope for works and lists. Club scope keys rows by `club_id`; user
 * scope keys them by `user_id` (solo spaces). The two are mutually exclusive at
 * the schema level (XOR check constraint), so a repository picks exactly one.
 */
export type Scope =
  | { kind: "club"; clubId: string }
  | { kind: "user"; userId: string };
