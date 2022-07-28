import { createStore } from "vuex";
import { authModule } from "./modules/auth";

export default createStore<never>({
  mutations: {},
  actions: {},
  modules: {
    auth: authModule
  },
});
