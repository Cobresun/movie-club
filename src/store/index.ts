import { createStore } from "vuex";
import { authModule } from "./modules/auth";

export default createStore({
  state: {},
  mutations: {},
  actions: {},
  modules: {
    auth: authModule
  },
});
