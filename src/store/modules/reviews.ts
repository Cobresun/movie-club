import { DetailedReviewResponse } from "@/common/types/models";
import { Module } from "vuex";

interface State {
  clubs: Record<string, DetailedReviewResponse[]>;
}

export const reviewModule: Module<State, never> = {
  namespaced: true,
  state: {
    clubs: {},
  },
  mutations: {
    addClub(state: State, { clubId, reviews }) {
      state.clubs[clubId] = reviews;
    },
    updateScore(state: State, { clubId, movieId, scores }) {
      const review = state.clubs[clubId].find(
        (movie) => movie.movieId === movieId
      );
      if (!review) return;
      review.scores = scores;
    },
    addReview(state: State, { clubId, review }) {
      state.clubs[clubId]?.unshift(review);
    },
  },
  getters: {
    getClubReviews: (state: State) => (clubId: string) => state.clubs[clubId],
  },
};
