import { ReviewResponse } from "@/models";
import { Module } from "vuex";

interface State {
  clubs: Record<string, ReviewResponse[]>;
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
    updateScore(state: State, { clubId, review }) {
      const reviews = state.clubs[clubId];
      state.clubs[clubId] = reviews.map((curReview) =>
        curReview.movieId === review.movieId ? review : curReview
      );
    },
  },
  getters: {
    getClubReviews: (state: State) => (clubId: string) => state.clubs[clubId],
  },
};
