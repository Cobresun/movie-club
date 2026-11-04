import { type UseQueryReturnType, useQuery } from "@tanstack/vue-query";
import axios, { type AxiosError } from "axios";

import { type DailyGameArchive, type DailyGamePuzzle } from "../../lib/types/dailyGame";
import { type ClubType } from "../../lib/types/generated/db";

/**
 * A day's puzzle for one club type's daily game. The answer for a date never
 * changes once drawn, so the response is kept for the session — and, through
 * the persisted cache, for a player who reopens the page with no connection.
 */
export function useDailyGamePuzzle(
  clubType: ClubType,
  date: string,
): UseQueryReturnType<DailyGamePuzzle, AxiosError> {
  return useQuery({
    queryKey: ["dailyGame", clubType, date],
    queryFn: async () =>
      (await axios.get<DailyGamePuzzle>(`/api/daily-game/${clubType}/${date}`)).data,
    staleTime: Infinity,
    retry: false,
  });
}

/** Every puzzle a club type's daily game has had, newest first. Grows by one a day. */
export function useDailyGameArchive(
  clubType: ClubType,
): UseQueryReturnType<DailyGameArchive, AxiosError> {
  return useQuery({
    queryKey: ["dailyGame", clubType, "archive"],
    queryFn: async () =>
      (await axios.get<DailyGameArchive>(`/api/daily-game/${clubType}/archive`)).data,
  });
}
