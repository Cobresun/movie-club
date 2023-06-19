import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { computed } from "vue";

import { Member } from "@/common/types/club";
import { useAuthStore } from "@/stores/auth";

export function useUser() {
  const store = useAuthStore();
  const email = computed(() => store.user?.email);
  const isLoggedIn = computed(() => store.isLoggedIn);

  return useQuery<Member>({
    queryKey: ["user", email],
    enabled: isLoggedIn,
    queryFn: async () => (await axios.get(`/api/member/${email.value}`)).data,
  });
}
