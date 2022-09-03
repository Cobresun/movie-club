import { clearCache } from "@/data/useRequest";
import netlifyIdentity, { User } from "netlify-identity-widget";
import { ActionContext, Module } from "vuex";

interface State {
  user?: User;
  ready: boolean;
}

export const authModule: Module<State, never> = {
  namespaced: true,
  state: {
    user: undefined,
    ready: false,
  },
  mutations: {
    setUser(state: State, value: User) {
      state.user = value;
    },
    setAuthReady(state: State, value: boolean) {
      state.ready = value;
    },
  },
  getters: {
    authToken(state) {
      return state.user?.token?.access_token;
    },
    isLoggedIn(state) {
      return state.user;
    },
  },
  actions: {
    init(context: ActionContext<State, never>) {
      netlifyIdentity.on("login", (user) => {
        netlifyIdentity.refresh();
        context.commit("setUser", user);
        netlifyIdentity.close();
      }),
        netlifyIdentity.on("logout", () => {
          context.commit("setUser", null);
          clearCache();
        });

      netlifyIdentity.on("init", (user) => {
        context.commit("setUser", user);
        context.commit("setAuthReady", true);
      });

      netlifyIdentity.init({
        APIUrl: "https://cobresun-movie-club.netlify.app/.netlify/identity",
      });
    },
    cleanup() {
      netlifyIdentity.off("login");
      netlifyIdentity.off("logout");
    },
    login() {
      netlifyIdentity.open();
    },
    logout() {
      netlifyIdentity.logout();
    },
  },
};
