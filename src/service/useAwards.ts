import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryReturnType,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";
import { Ref } from "vue";

import { hasValue, isDefined } from "../../lib/checks/checks.js";
import { Award, AwardsStep, ClubAwards } from "../../lib/types/awards";
import { DetailedReviewListItem } from "../../lib/types/lists";
import { DetailedMovieData } from "../../lib/types/movie";

import { useAuthStore } from "@/stores/auth";

export function useAwardYears(
  clubId: string,
): UseQueryReturnType<number[], AxiosError> {
  return useQuery({
    queryKey: ["awards-years", clubId],
    queryFn: async () =>
      (await axios.get<number[]>(`/api/club/${clubId}/awards/years`)).data,
  });
}

export function useAwards(
  clubId: Ref<string>,
  year: Ref<string>,
  onSuccess?: (data: ClubAwards) => void,
): UseQueryReturnType<ClubAwards, AxiosError> {
  return useQuery({
    queryKey: ["awards", clubId, year],
    queryFn: async () =>
      (
        await axios.get<ClubAwards>(
          `/api/club/${clubId.value}/awards/${year.value}`,
        )
      ).data,
    onSuccess,
  });
}

export function useUpdateStep(clubId: Ref<string>, year: Ref<string>) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (step: AwardsStep) =>
      auth.request.put(`/api/club/${clubId.value}/awards/${year.value}/step`, {
        step,
      }),
    onSettled: () => {
      queryClient
        .invalidateQueries(["awards", clubId, year])
        .catch(console.error);
    },
  });
}

export function useAddCategory(clubId: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      auth.request.post(`/api/club/${clubId}/awards/${year}/category`, {
        title,
      }),
    onMutate: async (title) => {
      await queryClient.cancelQueries(["awards", clubId, year]);
      queryClient.setQueryData<ClubAwards>(
        ["awards", clubId, year],
        (currentAwards) => {
          if (!currentAwards) return currentAwards;
          return {
            ...currentAwards,
            awards: [...currentAwards.awards, { title, nominations: [] }],
          };
        },
      );
    },
    onSettled: () => {
      queryClient
        .invalidateQueries(["awards", clubId, year])
        .catch(console.error);
    },
  });
}

export function useReorderCategories(clubId: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categories: string[]) =>
      auth.request.put(`/api/club/${clubId}/awards/${year}/category`, {
        categories,
      }),
    onMutate: async (categories) => {
      await queryClient.cancelQueries(["awards", clubId, year]);
      queryClient.setQueryData<ClubAwards>(
        ["awards", clubId, year],
        (currentAwards) => {
          if (!currentAwards) return currentAwards;
          return {
            ...currentAwards,
            awards: categories.map((category) =>
              currentAwards.awards.find((award) => award.title === category),
            ) as Award[],
          };
        },
      );
    },
    onSettled: () => {
      queryClient
        .invalidateQueries(["awards", clubId, year])
        .catch(console.error);
    },
  });
}

export function useDeleteCategory(clubId: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (award: Award) =>
      auth.request.delete(
        `/api/club/${clubId}/awards/${year}/category/${encodeURIComponent(
          award.title,
        )}`,
      ),
    onMutate: async (award) => {
      await queryClient.cancelQueries(["awards", clubId, year]);
      queryClient.setQueryData<ClubAwards>(
        ["awards", clubId, year],
        (currentAwards) => {
          if (!currentAwards) return currentAwards;
          return {
            ...currentAwards,
            awards: currentAwards.awards.filter(
              (curAward) => curAward.title !== award.title,
            ),
          };
        },
      );
    },
    onSettled: () => {
      queryClient
        .invalidateQueries(["awards", clubId, year])
        .catch(console.error);
    },
  });
}

export function useAddNomination(clubId: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
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
      return auth.request.post(
        `/api/club/${clubId}/awards/${year}/nomination`,
        {
          awardTitle,
          movieId: parseInt(review.externalId),
          nominatedBy: auth.user?.name,
        },
      );
    },
    onMutate: async ({ awardTitle, review }) => {
      await queryClient.cancelQueries(["awards", clubId, year]);
      queryClient.setQueryData<ClubAwards>(
        ["awards", clubId, year],
        (currentClubAwards) => {
          const name = auth.user?.name;
          if (!currentClubAwards || !hasValue(name)) return currentClubAwards;
          return {
            ...currentClubAwards,
            awards: currentClubAwards.awards.map((award) => {
              if (award.title === awardTitle) {
                return {
                  ...award,
                  nominations: [
                    ...award.nominations,
                    {
                      movieId: parseInt(review.externalId ?? "0"),
                      movieTitle: review.title,
                      posterUrl: review.imageUrl ?? "",
                      movieData: review.externalData as DetailedMovieData,
                      nominatedBy: [name],
                      ranking: {},
                    },
                  ],
                };
              } else {
                return award;
              }
            }),
          };
        },
      );
    },
    onSettled: () => {
      queryClient
        .invalidateQueries({ queryKey: ["awards", clubId, year] })
        .catch(console.error);
    },
  });
}

export function useDeleteNomination(clubId: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { awardTitle: string; movieId: number }) =>
      auth.request.delete(
        `/api/club/${clubId}/awards/${year}/nomination/${input.movieId}`,
        {
          params: { awardTitle: input.awardTitle, userId: auth.user?.name },
        },
      ),
    onMutate: async (input) => {
      await queryClient.cancelQueries(["awards", clubId, year]);

      queryClient.setQueryData(
        ["awards", clubId, year],
        (currentAwards: ClubAwards | undefined) => {
          if (!currentAwards) return currentAwards;

          const updatedAwards = currentAwards.awards.map((award: Award) => {
            if (award.title === input.awardTitle) {
              const updatedNominations = award.nominations
                .map((nomination) => {
                  if (nomination.movieId === input.movieId) {
                    return {
                      ...nomination,
                      nominatedBy: nomination.nominatedBy.filter(
                        (nominator) => nominator !== auth.user?.name,
                      ),
                    };
                  }
                  return nomination;
                })
                .filter((nomination) => nomination.nominatedBy.length > 0);

              return { ...award, nominations: updatedNominations };
            }
            return award;
          });

          return { ...currentAwards, awards: updatedAwards };
        },
      );
    },
    onSettled: () => {
      queryClient
        .invalidateQueries(["awards", clubId, year])
        .catch(console.error);
    },
  });
}

export function useSubmitRanking(clubId: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      awardTitle,
      movies,
    }: {
      awardTitle: string;
      movies: number[];
    }) =>
      auth.request.post(`/api/club/${clubId}/awards/${year}/ranking`, {
        awardTitle,
        voter: auth.user?.name,
        movies,
      }),
    onSettled: () => {
      queryClient
        .invalidateQueries({ queryKey: ["awards", clubId, year] })
        .catch(console.error);
    },
  });
}
