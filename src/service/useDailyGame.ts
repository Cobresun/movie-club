import { type UseQueryReturnType, useMutation, useQuery } from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

import { type DailyGameResultBody } from "../../lib/dailyGame";
import { type DailyGameArchive, type DailyGamePuzzle } from "../../lib/types/dailyGame";
import { type ClubType } from "../../lib/types/generated/db";
import { http, type HttpError } from "@/common/http";

/**
 * A day's puzzle for one club type's daily game. The answer for a date never
 * changes once drawn, so the response is kept for the session — and, through
 * the persisted cache, for a player who reopens the page with no connection.
 *
 * Both arguments are reactive: the router reuses the view between a mode's
 * days, and between modes, so the query follows what it's given.
 */
export function useDailyGamePuzzle(
  clubType: MaybeRefOrGetter<ClubType>,
  date: MaybeRefOrGetter<string>,
): UseQueryReturnType<DailyGamePuzzle, HttpError> {
  return useQuery({
    queryKey: computed(() => ["dailyGame", toValue(clubType), toValue(date)]),
    queryFn: async () =>
      (await http.get<DailyGamePuzzle>(`/api/daily-game/${toValue(clubType)}/${toValue(date)}`))
        .data,
    staleTime: Infinity,
    retry: false,
  });
}

/** Records a finished puzzle for the site's stats. Nothing on screen depends on it. */
export function useRecordDailyGameResult(clubType: ClubType, date: string) {
  return useMutation({
    mutationFn: (result: DailyGameResultBody) =>
      http.post(`/api/daily-game/${clubType}/${date}/result`, result),
  });
}

/** Every puzzle a club type's daily game has had, newest first. Grows by one a day. */
export function useDailyGameArchive(
  clubType: MaybeRefOrGetter<ClubType>,
): UseQueryReturnType<DailyGameArchive, HttpError> {
  return useQuery({
    queryKey: computed(() => ["dailyGame", toValue(clubType), "archive"]),
    queryFn: async () =>
      (await http.get<DailyGameArchive>(`/api/daily-game/${toValue(clubType)}/archive`)).data,
  });
}
