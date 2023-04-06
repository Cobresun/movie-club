import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryReturnType,
} from "@tanstack/vue-query";
import axios, { AxiosError } from "axios";
import { Ref } from "vue";

import { useUser } from "./useUser";

import {
  Award,
  AwardsStep,
  ClubAwards,
  DetailedReviewResponse,
} from "@/common/types/models";
import { useAuthStore } from "@/stores/auth";

export function useAwardYears(
  clubId: string
): UseQueryReturnType<number[], AxiosError> {
  return useQuery({
    queryKey: ["awards-years", clubId],
    queryFn: async () =>
      (await axios.get(`/api/club/${clubId}/awards/years`)).data,
  });
}

export function useAwards(
  clubId: Ref<string>,
  year: Ref<string>,
  onSuccess?: (data: ClubAwards) => void
): UseQueryReturnType<ClubAwards, AxiosError> {
  return useQuery({
    queryKey: ["awards", clubId, year],
    queryFn: async () =>
      (await axios.get(`/api/club/${clubId.value}/awards/${year.value}`)).data,
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
      queryClient.invalidateQueries(["awards", clubId, year]);
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
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(["awards", clubId, year]);
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
              currentAwards.awards.find((award) => award.title === category)
            ) as Award[],
          };
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(["awards", clubId, year]);
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
          award.title
        )}`
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
              (curAward) => curAward.title !== award.title
            ),
          };
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(["awards", clubId, year]);
    },
  });
}

export function useAddNomination(clubId: string, year: string) {
  const { data: user } = useUser();
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      awardTitle,
      review,
    }: {
      awardTitle: string;
      review: DetailedReviewResponse;
    }) =>
      auth.request.post(`/api/club/${clubId}/awards/${year}/nomination`, {
        awardTitle,
        movieId: review.movieId,
        nominatedBy: user.value?.name,
      }),
    onMutate: async ({ awardTitle, review }) => {
      await queryClient.cancelQueries(["awards", clubId, year]);
      queryClient.setQueryData<ClubAwards>(
        ["awards", clubId, year],
        (currentClubAwards) => {
          const name = user.value?.name;
          if (!currentClubAwards || !name) return currentClubAwards;
          return {
            ...currentClubAwards,
            awards: currentClubAwards.awards.map((award) => {
              if (award.title === awardTitle) {
                return {
                  ...award,
                  nominations: [
                    ...award.nominations,
                    {
                      movieId: review.movieId,
                      nominatedBy: [name],
                      ranking: {},
                      movieData: review.movieData,
                      movieTitle: review.movieTitle,
                    },
                  ],
                };
              } else {
                return award;
              }
            }),
          };
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["awards", clubId, year] });
    },
  });
}

export function useDeleteNomination(clubId: string, year: string) {
  const { authToken } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: user } = useUser();

  return useMutation({
    mutationFn: (input: { awardTitle: string; movieId: number }) =>
      axios.delete(
        `/api/club/${clubId}/awards/${year}/nomination/${input.movieId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: { awardTitle: input.awardTitle, userId: user.value?.name },
        }
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
                        (nominator) => nominator !== user.value?.name
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
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries(["awards", clubId, year]);
    },
  });
}

export function useSubmitRanking(clubId: string, year: string) {
  const auth = useAuthStore();
  const { data: user } = useUser();
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
        voter: user.value?.name,
        movies,
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["awards", clubId, year] });
    },
  });
}
