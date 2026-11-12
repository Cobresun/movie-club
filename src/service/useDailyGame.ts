import { type UseQueryReturnType, useMutation, useQuery } from "@tanstack/vue-query";
import axios, { type AxiosError } from "axios";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

import { type DailyGameResultBody } from "../../lib/dailyGame";
import { type DailyGameArchive, type DailyGamePuzzle } from "../../lib/types/dailyGame";
import { type ClubType } from "../../lib/types/generated/db";

/**
 * A day's puzzle for one club type's daily game. The answer for a date never
 * changes once drawn, so the response is kept for the session — and, through
 * the persisted cache, for a player who reopens the page with no connection.
 *
 * `date` is reactive: the router reuses the view between `/reelated` and
 * `/reelated/:date`, so the query has to follow the date it's given.
 */
export function useDailyGamePuzzle(
  clubType: ClubType,
  date: MaybeRefOrGetter<string>,
): UseQueryReturnType<DailyGamePuzzle, AxiosError> {
  return useQuery({
    queryKey: computed(() => ["dailyGame", clubType, toValue(date)]),
    queryFn: async () =>
      (await axios.get<DailyGamePuzzle>(`/api/daily-game/${clubType}/${toValue(date)}`)).data,
    staleTime: Infinity,
    retry: false,
  });
}

/** Records a finished puzzle for the site's stats. Nothing on screen depends on it. */
export function useRecordDailyGameResult(clubType: ClubType, date: string) {
  return useMutation({
    mutationFn: (result: DailyGameResultBody) =>
      axios.post(`/api/daily-game/${clubType}/${date}/result`, result),
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
