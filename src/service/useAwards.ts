import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryReturnType,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";
import { Ref } from "vue";

import { useUser } from "./useUser";
import { hasValue, isDefined } from "../../lib/checks/checks.js";
import { Award, AwardsStep, ClubAwards } from "../../lib/types/awards";
import { DetailedReviewListItem } from "../../lib/types/lists";
import { DetailedMovieData } from "../../lib/types/movie";

import { useAuthStore } from "@/stores/auth";

export function useAwardYears(
  clubSlug: string,
): UseQueryReturnType<number[], AxiosError> {
  return useQuery({
    queryKey: ["awards-years", clubSlug],
    queryFn: async () =>
      (await axios.get<number[]>(`/api/club/${clubSlug}/awards/years`)).data,
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

export function useAddCategory(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      auth.request.post(`/api/club/${clubSlug}/awards/${year}/category`, {
        title,
      }),
    onMutate: async (title) => {
      await queryClient.cancelQueries(["awards", clubSlug, year]);
      queryClient.setQueryData<ClubAwards>(
        ["awards", clubSlug, year],
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
        .invalidateQueries(["awards", clubSlug, year])
        .catch(console.error);
    },
  });
}

export function useReorderCategories(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categories: string[]) =>
      auth.request.put(`/api/club/${clubSlug}/awards/${year}/category`, {
        categories,
      }),
    onMutate: async (categories) => {
      await queryClient.cancelQueries(["awards", clubSlug, year]);
      queryClient.setQueryData<ClubAwards>(
        ["awards", clubSlug, year],
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
        .invalidateQueries(["awards", clubSlug, year])
        .catch(console.error);
    },
  });
}

export function useDeleteCategory(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (award: Award) =>
      auth.request.delete(
        `/api/club/${clubSlug}/awards/${year}/category/${encodeURIComponent(
          award.title,
        )}`,
      ),
    onMutate: async (award) => {
      await queryClient.cancelQueries(["awards", clubSlug, year]);
      queryClient.setQueryData<ClubAwards>(
        ["awards", clubSlug, year],
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
        .invalidateQueries(["awards", clubSlug, year])
        .catch(console.error);
    },
  });
}

export function useAddNomination(clubSlug: string, year: string) {
  const user = useUser();
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
        `/api/club/${clubSlug}/awards/${year}/nomination`,
        {
          awardTitle,
          movieId: parseInt(review.externalId),
          nominatedBy: user.value?.name,
        },
      );
    },
    onMutate: async ({ awardTitle, review }) => {
      await queryClient.cancelQueries(["awards", clubSlug, year]);
      queryClient.setQueryData<ClubAwards>(
        ["awards", clubSlug, year],
        (currentClubAwards) => {
          const name = user.value?.name;
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
        .invalidateQueries({ queryKey: ["awards", clubSlug, year] })
        .catch(console.error);
    },
  });
}

export function useDeleteNomination(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const user = useUser();

  return useMutation({
    mutationFn: (input: { awardTitle: string; movieId: number }) =>
      auth.request.delete(
        `/api/club/${clubSlug}/awards/${year}/nomination/${input.movieId}`,
        {
          params: { awardTitle: input.awardTitle, userId: user.value?.name },
        },
      ),
    onMutate: async (input) => {
      await queryClient.cancelQueries(["awards", clubSlug, year]);

      queryClient.setQueryData(
        ["awards", clubSlug, year],
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
                        (nominator) => nominator !== user.value?.name,
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
        .invalidateQueries(["awards", clubSlug, year])
        .catch(console.error);
    },
  });
}

export function useSubmitRanking(clubSlug: string, year: string) {
  const auth = useAuthStore();
  const user = useUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      awardTitle,
      movies,
    }: {
      awardTitle: string;
      movies: number[];
    }) =>
      auth.request.post(`/api/club/${clubSlug}/awards/${year}/ranking`, {
        awardTitle,
        voter: user.value?.name,
        movies,
      }),
    onSettled: () => {
      queryClient
        .invalidateQueries({ queryKey: ["awards", clubSlug, year] })
        .catch(console.error);
    },
  });
}
