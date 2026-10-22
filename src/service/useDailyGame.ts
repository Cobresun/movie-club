import { UseQueryReturnType, useQuery } from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";

import { DailyGamePuzzle } from "../../lib/types/dailyGame";

/**
 * A day's Closer puzzle. The answer for a date never changes once drawn, so the
 * response is kept for the session — and, through the persisted cache, for a
 * player who reopens the page with no connection.
 */
export function useDailyGamePuzzle(date: string): UseQueryReturnType<DailyGamePuzzle, AxiosError> {
  return useQuery({
    queryKey: ["dailyGame", date],
    queryFn: async () => (await axios.get<DailyGamePuzzle>(`/api/daily-game/${date}`)).data,
    staleTime: Infinity,
    retry: false,
  });
}
