import { createStore } from "vuex";
import { authModule } from "./modules/auth";
import { reviewModule } from "./modules/reviews";

export default createStore<never>({
  mutations: {},
  actions: {},
  modules: {
    auth: authModule,
    reviews: reviewModule,
  },
});
