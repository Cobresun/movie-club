import { z } from "zod";

import { isDefined } from "../../../lib/checks/checks.js";

const REMEMBERED_USER_KEY = "rememberedUser";

const rememberedUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  image: z.string().nullish(),
});

/** The member the last resolved session belonged to. */
export type RememberedUser = z.infer<typeof rememberedUserSchema>;

/**
 * `localStorage` is not always there to be read. It is missing outside a
 * browser (the watcher that keeps the record honest can flush after a test's
 * DOM has been torn down) and it throws outright when a browser has site
 * data blocked. What is kept here is a guess about the session to come, so
 * losing it costs one slower load — never an error.
 */
function withStorage<T>(fallback: T, use: (storage: Storage) => T): T {
  try {
    if (typeof localStorage === "undefined") return fallback;
    return use(localStorage);
  } catch {
    return fallback;
  }
}

/**
 * Who was signed in when this browser last resolved a session, if anyone.
 *
 * A cold load can't know where it is headed: the session check is a round
 * trip, and until it comes back the app can't tell a member from a visitor.
 * This is the guess it makes in the meantime. A member's last session almost
 * always turns out to still be theirs, so the app starts as them, on what it
 * has cached, rather than holding the screen for the check. The real session
 * corrects it either way: a session that expired since the last visit is sent
 * where a signed-out visitor belongs, and the record is dropped.
 */
export function getRememberedUser(): RememberedUser | undefined {
  return withStorage(undefined, (storage) => {
    const stored = storage.getItem(REMEMBERED_USER_KEY);
    if (stored === null) return undefined;
    const parsed = rememberedUserSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : undefined;
  });
}

/** Records the member a session resolved to, or, given none, that it resolved signed out. */
export function setRememberedUser(user: RememberedUser | undefined): void {
  withStorage(undefined, (storage) => {
    // Parsed on the way in as well: a session carries more than this about its
    // user, and only these fields are kept.
    const parsed = rememberedUserSchema.safeParse(user);
    if (parsed.success) {
      storage.setItem(REMEMBERED_USER_KEY, JSON.stringify(parsed.data));
    } else {
      storage.removeItem(REMEMBERED_USER_KEY);
    }
  });
}

/** Whether the last session this browser resolved was a signed-in one. */
export function getSignedInHint(): boolean {
  return isDefined(getRememberedUser());
}
