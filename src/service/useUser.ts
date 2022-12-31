import { computed, watch } from "vue";

import { useRequestCache } from "./useRequest";

import { CacheDataService, Member } from "@/common/types/models";
import { useAuthStore } from "@/stores/auth";

export function useUser(): CacheDataService<Member> {
  const store = useAuthStore();
  const email = computed(() => store.user?.email);
  const isLoggedIn = computed(() => store.isLoggedIn);

  const info = useRequestCache<Member>(
    `user-${email.value}`,
    `/api/member/${email.value}`,
    { skip: !isLoggedIn.value }
  );
  watch(isLoggedIn, (newValue) => {
    if (newValue) {
      info.updateKey(`user-${email.value}`);
      info.execute(`/api/member/${email.value}`);
    }
  });

  return { ...info };
}
