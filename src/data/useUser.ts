import { DataService, Member } from "@/models";
import { computed, watch } from "vue";
import { useStore } from "vuex";
import { useFetchCache } from "./useFetch";

export function useUser(): DataService<Member> {
  const store = useStore();
  const email = computed(() => store.state.auth.user?.email);
  const isLoggedIn = computed(() => store.getters['auth/isLoggedIn']);

  const info = useFetchCache<Member>(`user-${email.value}`, `/api/member/${email.value}`, {skip: !isLoggedIn.value});
  watch(isLoggedIn, (newValue) => {
    if (newValue) {
      info.updateKey(`user-${email.value}`);
      info.updateUrl(`/api/member/${email.value}`);
      info.fetch();
    }
  });

  return {...info};
}