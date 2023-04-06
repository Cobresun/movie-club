import axios from "axios";
import netlifyIdentity, { User } from "netlify-identity-widget";
import { defineStore } from "pinia";
import { ref, computed } from "vue";

import { clearCache } from "@/service/useRequest";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>();
  const ready = ref(false);

  const authToken = computed(() => user.value?.token?.access_token);
  const isLoggedIn = computed(() => !!user.value);

  const request = computed(() =>
    axios.create({ headers: { Authorization: `Bearer ${authToken.value}` } })
  );

  netlifyIdentity.on("init", (initUser) => {
    user.value = initUser;
    ready.value = true;
  });

  netlifyIdentity.on("login", (loginUser) => {
    netlifyIdentity.refresh().then(() => {
      user.value = netlifyIdentity.currentUser();
    });
    user.value = loginUser;
    netlifyIdentity.close();
  });

  netlifyIdentity.on("logout", () => {
    user.value = null;
    clearCache();
  });

  netlifyIdentity.init({
    APIUrl: "https://cobresun-movie-club.netlify.app/.netlify/identity",
  });

  const cleanup = () => {
    netlifyIdentity.off("login");
    netlifyIdentity.off("logout");
  };
  const login = () => {
    netlifyIdentity.open();
  };
  const logout = () => {
    netlifyIdentity.logout();
  };

  return {
    user,
    ready,
    authToken,
    request,
    isLoggedIn,
    cleanup,
    login,
    logout,
  };
});
