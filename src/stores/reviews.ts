import { defineStore } from "pinia";

import { DetailedReviewResponse } from "@/common/types/models";

export const useReviewsStore = defineStore('review', {
  state: () => ({ clubs: {} as Record<string, DetailedReviewResponse[]> }),
  getters: {
    getClubReviews: (state) => (clubId: string) => state.clubs[clubId],
  },
  actions: {
    addClub(clubId: string, reviews: DetailedReviewResponse[]) {
      this.clubs[clubId] = reviews;
    },
    updateScore(clubId: string, movieId: number, scores: Record<string, number>) {
      const review = this.clubs[clubId].find(
        (movie) => movie.movieId === movieId
      );
      if (!review) return;
      review.scores = scores;
    },
    addReview(clubId: string, review: DetailedReviewResponse) {
      this.clubs[clubId]?.unshift(review);
    },
  }
})
