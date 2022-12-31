import { defineStore } from "pinia";

import { WatchListItem, WatchListViewModel } from "@/common/types/models";

export const useWatchListStore = defineStore('watchList', {
  state: () => ({ clubs: {} as Record<string, WatchListViewModel> }),
  getters: {
    getWatchList: (state) => (clubId: string) => state.clubs[clubId],
  },
  actions: {
    addClub(clubId: string, watchList: WatchListViewModel) {
      this.clubs[clubId] = watchList;
    },
    addMovie(clubId: string, movie: WatchListItem) {
      this.clubs[clubId].watchList.push(movie);
    },
    deleteMovie(clubId: string, movieId: number) {
      this.clubs[clubId].watchList = this.clubs[clubId].watchList.filter(
        (movie) => movie.movieId !== movieId
      );
    },
    addBacklogItem(clubId: string, movie: WatchListItem) {
      this.clubs[clubId].backlog.push(movie);
    },
    deleteBacklogItem(clubId: string, movieId: number) {
      this.clubs[clubId].backlog = this.clubs[clubId].backlog.filter(
        (movie) => movie.movieId !== movieId
      );
    },
    nextMovie(clubId: string, movieId: number) {
      this.clubs[clubId].nextMovieId = movieId;
    }
  }
})
