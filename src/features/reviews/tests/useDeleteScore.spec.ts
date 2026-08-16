import { QueryClient, useQueryClient } from "@tanstack/vue-query";
import { screen, waitFor } from "@testing-library/vue";
import { defineComponent, h } from "vue";

import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import memberData from "@/mocks/data/member.json";
import { reviewsListKey } from "@/service/useList";
import { useDeleteScore } from "@/service/useReviews";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

/**
 * The optimistic half of removing your own score. The DELETE itself is covered
 * through the UI (ScoreEntryPanel, ReviewView); what needs asserting here is
 * the cache rewrite — in particular that the club average is recomputed rather
 * than left reporting a number that still includes the score just removed.
 */

const CLUB_SLUG = "test-club";

/** Captured from the harness so the test can read the cache the mutation wrote. */
let queryClient: QueryClient;

const Harness = defineComponent({
  setup() {
    queryClient = useQueryClient();
    const { mutate } = useDeleteScore(CLUB_SLUG);
    return () =>
      h(
        "button",
        { onClick: () => mutate({ reviewId: "review-mine", workId: "work-1" }) },
        "remove",
      );
  },
});

function review(scores: DetailedReviewListItem["scores"]): DetailedReviewListItem {
  return {
    id: "work-1",
    type: WorkType.movie,
    title: "12 Angry Men",
    createdDate: "2024-05-28T04:46:37.751Z",
    scores,
  };
}

function score(id: string, value: number) {
  return { id, created_date: "2024-05-28T04:46:37.751Z", score: value };
}

async function removeScore(seeded: DetailedReviewListItem[]) {
  const { user, pinia } = render(Harness);

  const authStore = useAuthStore(pinia);
  // @ts-expect-error Overwriting readonly property for testing purposes
  authStore.user = { id: memberData.id, email: memberData.email, name: memberData.name };

  queryClient.setQueryData(reviewsListKey(CLUB_SLUG), seeded);
  await user.click(screen.getByRole("button", { name: "remove" }));
}

const cachedScores = () =>
  queryClient.getQueryData<DetailedReviewListItem[]>(reviewsListKey(CLUB_SLUG))?.[0].scores;

describe("useDeleteScore", () => {
  it("drops the member's score and recomputes the average from what is left", async () => {
    await removeScore([
      review({
        [memberData.id]: score("review-mine", 10),
        "3": score("review-theirs", 6),
        average: score("average", 8),
      }),
    ]);

    await waitFor(() => expect(cachedScores()?.[memberData.id]).toBeUndefined());
    expect(cachedScores()?.["3"].score).toBe(6);
    expect(cachedScores()?.average.score).toBe(6);
  });

  it("empties the score map when the removed score was the only one", async () => {
    await removeScore([
      review({
        [memberData.id]: score("review-mine", 10),
        average: score("average", 10),
      }),
    ]);

    // Matches the server's own empty-map answer, so the work reads as unrated
    // rather than as rated with an average of nothing.
    await waitFor(() => expect(cachedScores()).toEqual({}));
  });
});
