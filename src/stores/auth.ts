import { useQuery, useQueryClient } from "@tanstack/vue-query";
import axios from "axios";
import netlifyIdentity, { User } from "netlify-identity-widget";
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>();
  const ready = ref(false);
  const userHasValue = computed(() => !!user.value);

  const { data: authToken } = useQuery({
    queryKey: ["authToken", user],
    queryFn: () => {
      const token = netlifyIdentity.refresh(true);
      user.value = netlifyIdentity.currentUser();
      return token;
    },
    enabled: userHasValue,
    refetchInterval: 60 * 59 * 1000, // Refetch after 59mins
  });

  const isLoggedIn = computed(() => !!authToken.value);

  const request = computed(() =>
    axios.create({ headers: { Authorization: `Bearer ${authToken.value}` } }),
  );

  netlifyIdentity.on("init", (initUser) => {
    user.value = initUser;
    ready.value = true;
  });

  netlifyIdentity.on("login", (loginUser) => {
    user.value = loginUser;
    netlifyIdentity.close();
  });

  const queryClient = useQueryClient();
  netlifyIdentity.on("logout", () => {
    user.value = null;
    queryClient.removeQueries({ queryKey: ["user"] });
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
  const router = useRouter();
  const route = useRoute();
  const logout = () => {
    if (route.meta.authRequired) {
      router.push({ name: "Clubs" });
    }
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
