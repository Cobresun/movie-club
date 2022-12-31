import netlifyIdentity, { User } from "netlify-identity-widget";
import { defineStore } from 'pinia'

import { clearCache } from "@/service/useRequest";

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: null as User | null, ready: false }),
  getters: {
    authToken: (state) => state.user?.token?.access_token,
    isLoggedIn: (state) => state.user
  },
  actions: {
    init() {
      netlifyIdentity.on("login", (user) => {
        netlifyIdentity.refresh().then(() => console.log("Refreshed"));
        this.user = user;
        netlifyIdentity.close();
      }),
        netlifyIdentity.on("logout", () => {
          this.user = null;
          clearCache();
        });

      netlifyIdentity.on("init", (user) => {
        this.user = user;
        this.ready = true;
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
  }
})
