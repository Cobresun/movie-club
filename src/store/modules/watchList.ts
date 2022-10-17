import { WatchListViewModel } from "@/models";
import { Module } from "vuex";

interface State {
  clubs: Record<string, WatchListViewModel>;
}

export const watchListModule: Module<State, never> = {
  namespaced: true,
  state: {
    clubs: {},
  },
  mutations: {
    addClub(state: State, { clubId, watchList }) {
      state.clubs[clubId] = watchList;
    },
    addMovie(state: State, { clubId, movie }) {
      state.clubs[clubId].watchList.push(movie);
    },
    deleteMovie(state: State, { clubId, movieId }) {
      state.clubs[clubId].watchList = state.clubs[clubId].watchList.filter(
        (movie) => movie.movieId !== movieId
      );
    },
    deleteBacklogItem(state: State, { clubId, movieId }) {
      state.clubs[clubId].backlog = state.clubs[clubId].backlog.filter(
        (movie) => movie.movieId !== movieId
      );
    },
    nextMovie(state: State, { clubId, movieId }) {
      state.clubs[clubId].nextMovieId = movieId;
    },
  },
  getters: {
    getWatchList: (state: State) => (clubId: string) => state.clubs[clubId],
  },
};
