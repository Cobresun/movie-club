import { z } from "zod";

const PLAYER_ID_KEY = "movieclub:daily-game:player";

let visitPlayerId: string | undefined;

/**
 * A random id this browser keeps for every daily game, so a finished puzzle
 * counts once per player in the site's stats. Without storage it lasts the visit.
 */
export function playerId(): string {
  try {
    const stored = z.string().uuid().safeParse(localStorage.getItem(PLAYER_ID_KEY));
    if (stored.success) return stored.data;
    const id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    visitPlayerId ??= crypto.randomUUID();
    return visitPlayerId;
  }
}
