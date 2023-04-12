import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import netlifyIdentity, { User } from "netlify-identity-widget";
import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>();
  const ready = ref(false);
  const isLoggedIn = computed(() => !!user.value);

  const { data: authToken } = useQuery({
    queryKey: ["authToken"],
    queryFn: () => {
      const token = netlifyIdentity.refresh();
      user.value = netlifyIdentity.currentUser();
      return token;
    },
    enabled: isLoggedIn,
    refetchInterval: 60 * 59 * 1000, // Refetch after 59mins
  });

  const request = computed(() =>
    axios.create({ headers: { Authorization: `Bearer ${authToken.value}` } })
  );

  netlifyIdentity.on("init", (initUser) => {
    user.value = initUser;
    ready.value = true;
  });

  netlifyIdentity.on("login", (loginUser) => {
    user.value = loginUser;
    netlifyIdentity.close();
  });

  netlifyIdentity.on("logout", () => {
    user.value = null;
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
