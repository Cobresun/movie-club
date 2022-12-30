import { createStore } from "vuex";

import { authModule } from "./modules/auth";
import { reviewModule } from "./modules/reviews";
import { watchListModule } from "./modules/watchList";

export default createStore<never>({
  mutations: {},
  actions: {},
  modules: {
    auth: authModule,
    reviews: reviewModule,
    watchList: watchListModule,
  },
});
