import { computed, watch } from "vue";
import { useStore } from "vuex";

import { useRequestCache } from "./useRequest";

import { CacheDataService, Member } from "@/common/types/models";

export function useUser(): CacheDataService<Member> {
  const store = useStore();
  const email = computed(() => store.state.auth.user?.email);
  const isLoggedIn = computed(() => store.getters["auth/isLoggedIn"]);

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
