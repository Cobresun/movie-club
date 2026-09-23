import { useMutation, useQuery, useQueryClient, UseQueryReturnType } from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";
import { computed, Ref } from "vue";
import { useToast } from "vue-toastification";

import { hasValue, isDefined } from "../../lib/checks/checks.js";
import { AwardsStep, ClubAwards } from "../../lib/types/awards";
import { DetailedReviewListItem } from "../../lib/types/lists";
import { DetailedMovieData } from "../../lib/types/movie";
import { useUser } from "./useUser";
import { useAuthStore } from "@/stores/auth";

const awardYearsKey = (clubSlug: string) => ["awards-years", clubSlug];
const availableYearsKey = (clubSlug: string) => ["awards-available-years", clubSlug];
const awardsKey = (clubSlug: string, year: string) => ["awards", clubSlug, year];

/** Toasts the reason the server refused an awards change. */
function useAwardsErrorToast() {
  const toast = useToast();
  return (error: unknown) => {
    const message = axios.isAxiosError<{ error?: string }>(error)
      ? error.response?.data?.error
      : undefined;
    toast.error(message ?? "Something went wrong. Please try again.");
  };
}

export function useAwardYears(clubSlug: string): UseQueryReturnType<number[], AxiosError> {
  return useQuery({
    queryKey: awardYearsKey(clubSlug),
    queryFn: async () => (await axios.get<number[]>(`/api/club/${clubSlug}/awards/years`)).data,
  });
}

/** Years the club reviewed movies in that have no awards yet, newest first. */
export function useAvailableAwardYears(clubSlug: string): UseQueryReturnType<number[], AxiosError> {
  return useQuery({
    queryKey: availableYearsKey(clubSlug),
    queryFn: async () =>
      (await axios.get<number[]>(`/api/club/${clubSlug}/awards/available-years`)).data,
  });
}

export function useAwards(
  clubId: Ref<string>,
  year: Ref<string>,
): UseQueryReturnType<ClubAwards, AxiosError> {
  return useQuery({
    queryKey: ["awards", clubId, year],
    queryFn: async () =>
      (await axios.get<ClubAwards>(`/api/club/${clubId.value}/awards/${year.value}`)).data,
    enabled: computed(() => hasValue(year.value)),
  });
}

export function useCreateAwardsYear(clubSlug: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const onError = useAwardsErrorToast();
  return useMutation({
    mutationFn: (input: { year: number; categories: string[] }) =>
      auth.request.post(`/api/club/${clubSlug}/awards`, input),
    onError,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries(awardYearsKey(clubSlug)),
        queryClient.invalidateQueries(availableYearsKey(clubSlug)),
      ]),
  });
}

export function useDeleteAwardsYear(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const onError = useAwardsErrorToast();
  return useMutation({
    mutationFn: () => auth.request.delete(`/api/club/${clubSlug}/awards/${year}`),
    onMutate: async () => {
      await queryClient.cancelQueries(awardYearsKey(clubSlug));
      queryClient.setQueryData<number[]>(awardYearsKey(clubSlug), (years) =>
        years?.filter((existing) => existing.toString() !== year),
      );
    },
    onError,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries(awardYearsKey(clubSlug)),
        queryClient.invalidateQueries(availableYearsKey(clubSlug)),
      ]),
  });
}

export function useUpdateStep(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const onError = useAwardsErrorToast();
  return useMutation({
    mutationFn: (step: AwardsStep) =>
      auth.request.put(`/api/club/${clubSlug}/awards/${year}/step`, { step }),
    onMutate: async (step) => {
      await queryClient.cancelQueries(awardsKey(clubSlug, year));
      queryClient.setQueryData<ClubAwards>(awardsKey(clubSlug, year), (current) =>
        current ? { ...current, step } : current,
      );
    },
    onError,
    onSettled: () => {
      queryClient.invalidateQueries(awardsKey(clubSlug, year)).catch(console.error);
    },
  });
}

export function useAddCategory(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const onError = useAwardsErrorToast();
  return useMutation({
    mutationFn: (title: string) =>
      auth.request.post(`/api/club/${clubSlug}/awards/${year}/category`, {
        title,
      }),
    onMutate: async (title) => {
      await queryClient.cancelQueries(awardsKey(clubSlug, year));
      queryClient.setQueryData<ClubAwards>(awardsKey(clubSlug, year), (currentAwards) => {
        if (!currentAwards) return currentAwards;
        return {
          ...currentAwards,
          awards: [...currentAwards.awards, { title, nominations: [] }],
        };
      });
    },
    onError,
    onSettled: () => {
      queryClient.invalidateQueries(awardsKey(clubSlug, year)).catch(console.error);
    },
  });
}

export function useReorderCategories(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const onError = useAwardsErrorToast();
  return useMutation({
    mutationFn: (categories: string[]) =>
      auth.request.put(`/api/club/${clubSlug}/awards/${year}/category`, {
        categories,
      }),
    onMutate: async (categories) => {
      await queryClient.cancelQueries(awardsKey(clubSlug, year));
      queryClient.setQueryData<ClubAwards>(awardsKey(clubSlug, year), (currentAwards) => {
        if (!currentAwards) return currentAwards;
        return {
          ...currentAwards,
          awards: categories
            .map((category) => currentAwards.awards.find((award) => award.title === category))
            .filter(isDefined),
        };
      });
    },
    onError,
    onSettled: () => {
      queryClient.invalidateQueries(awardsKey(clubSlug, year)).catch(console.error);
    },
  });
}

export function useDeleteCategory(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const onError = useAwardsErrorToast();
  return useMutation({
    mutationFn: (awardTitle: string) =>
      auth.request.delete(
        `/api/club/${clubSlug}/awards/${year}/category/${encodeURIComponent(awardTitle)}`,
      ),
    onMutate: async (awardTitle) => {
      await queryClient.cancelQueries(awardsKey(clubSlug, year));
      queryClient.setQueryData<ClubAwards>(awardsKey(clubSlug, year), (currentAwards) => {
        if (!currentAwards) return currentAwards;
        return {
          ...currentAwards,
          awards: currentAwards.awards.filter((award) => award.title !== awardTitle),
        };
      });
    },
    onError,
    onSettled: () => {
      queryClient.invalidateQueries(awardsKey(clubSlug, year)).catch(console.error);
    },
  });
}

export function useAddNomination(clubSlug: string, year: string) {
  const user = useUser();
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const onError = useAwardsErrorToast();
  return useMutation({
    mutationFn: ({
      awardTitle,
      review,
    }: {
      awardTitle: string;
      review: DetailedReviewListItem;
    }) => {
      if (!isDefined(review.externalId)) {
        throw new Error("External ID not found");
      }
      return auth.request.post(`/api/club/${clubSlug}/awards/${year}/nomination`, {
        awardTitle,
        movieId: parseInt(review.externalId),
      });
    },
    onMutate: async ({ awardTitle, review }) => {
      await queryClient.cancelQueries(awardsKey(clubSlug, year));
      queryClient.setQueryData<ClubAwards>(awardsKey(clubSlug, year), (currentClubAwards) => {
        const userId = user.value?.id;
        if (!currentClubAwards || !hasValue(userId) || !isDefined(review.externalId)) {
          return currentClubAwards;
        }
        const movieId = parseInt(review.externalId);
        return {
          ...currentClubAwards,
          awards: currentClubAwards.awards.map((award) => {
            if (award.title !== awardTitle) return award;
            if (award.nominations.some((nomination) => nomination.movieId === movieId)) {
              return {
                ...award,
                nominations: award.nominations.map((nomination) =>
                  nomination.movieId === movieId
                    ? { ...nomination, nominatedBy: [...nomination.nominatedBy, userId] }
                    : nomination,
                ),
              };
            }
            return {
              ...award,
              nominations: [
                ...award.nominations,
                {
                  movieId,
                  movieTitle: review.title,
                  posterUrl: review.imageUrl ?? "",
                  movieData: review.externalData as DetailedMovieData,
                  nominatedBy: [userId],
                  ranking: {},
                },
              ],
            };
          }),
        };
      });
    },
    onError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: awardsKey(clubSlug, year) }).catch(console.error);
    },
  });
}

export function useDeleteNomination(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const user = useUser();
  const onError = useAwardsErrorToast();

  return useMutation({
    mutationFn: (input: { awardTitle: string; movieId: number }) =>
      auth.request.delete(`/api/club/${clubSlug}/awards/${year}/nomination/${input.movieId}`, {
        params: { awardTitle: input.awardTitle },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries(awardsKey(clubSlug, year));

      queryClient.setQueryData<ClubAwards>(awardsKey(clubSlug, year), (currentAwards) => {
        if (!currentAwards) return currentAwards;
        return {
          ...currentAwards,
          awards: currentAwards.awards.map((award) => {
            if (award.title !== input.awardTitle) return award;
            return {
              ...award,
              nominations: award.nominations
                .map((nomination) =>
                  nomination.movieId === input.movieId
                    ? {
                        ...nomination,
                        nominatedBy: nomination.nominatedBy.filter(
                          (nominator) => nominator !== user.value?.id,
                        ),
                      }
                    : nomination,
                )
                .filter((nomination) => nomination.nominatedBy.length > 0),
            };
          }),
        };
      });
    },
    onError,
    onSettled: () => {
      queryClient.invalidateQueries(awardsKey(clubSlug, year)).catch(console.error);
    },
  });
}

export function useSubmitRanking(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const user = useUser();
  const queryClient = useQueryClient();
  const onError = useAwardsErrorToast();
  return useMutation({
    mutationFn: ({ awardTitle, movies }: { awardTitle: string; movies: number[] }) =>
      auth.request.post(`/api/club/${clubSlug}/awards/${year}/ranking`, {
        awardTitle,
        movies,
      }),
    onMutate: async ({ awardTitle, movies }) => {
      await queryClient.cancelQueries(awardsKey(clubSlug, year));
      queryClient.setQueryData<ClubAwards>(awardsKey(clubSlug, year), (currentAwards) => {
        const userId = user.value?.id;
        if (!currentAwards || !hasValue(userId)) return currentAwards;
        return {
          ...currentAwards,
          awards: currentAwards.awards.map((award) =>
            award.title !== awardTitle
              ? award
              : {
                  ...award,
                  nominations: award.nominations.map((nomination) => ({
                    ...nomination,
                    ranking: {
                      ...nomination.ranking,
                      [userId]: movies.indexOf(nomination.movieId) + 1,
                    },
                  })),
                },
          ),
        };
      });
    },
    onError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: awardsKey(clubSlug, year) }).catch(console.error);
    },
  });
}
