import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { VueQueryPlugin, VueQueryPluginOptions } from "@tanstack/vue-query";
import { del, get, set } from "idb-keyval";
import mdiVue from "mdi-vue/v3";
import { createPinia } from "pinia";
import { createApp, reactive, TransitionGroup } from "vue";
import Toast from "vue-toastification";

import { isDefined } from "../lib/checks/checks.js";
import LazyLoad from "./directives/LazyLoad";
import Reveal from "./directives/Reveal";
import { icons } from "./icons";
import router from "./router";
import App from "@/App.vue";
import EmptyState from "@/common/components/EmptyState.vue";
import Loading from "@/common/components/LoadingSpinner.vue";
import PageHeader from "@/common/components/PageHeader.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import VBackdrop from "@/common/components/VBackdrop.vue";
import VBtn from "@/common/components/VBtn.vue";
import VModal from "@/common/components/VModal.vue";
import VSelect from "@/common/components/VSelect.vue";
import VSwitch from "@/common/components/VSwitch.vue";
import VTable from "@/common/components/VTable.vue";
import MenuCard from "@/features/clubs/components/MenuCard.vue";

import "./assets/styles/tailwind.css";
import "vue-toastification/dist/index.css";

// Tracks how many times each query has fetched during *this* page session.
// It lives in memory and is empty on every load, which is the whole point:
// combined with the persister below it gives stale-while-revalidate on a hard
// refresh. The persister rehydrates cached data (instant paint), the empty map
// forces a background revalidate on the first mount(s), and repeat navigation
// within the session stays quiet. A fixed staleTime can't do this — it can't
// tell "remounted during the session" from "reloaded the page" — so collaborative
// data (scores, lists, awards, comments) would otherwise go stale across refreshes.
const fetchedMap = reactive(new Map<string, number>());

const vueQueryOptions: VueQueryPluginOptions = {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnMount: (query) => {
          if (query.state.isInvalidated) {
            return true;
          }
          const refetchTimes = fetchedMap.get(query.queryHash);
          if (isDefined(refetchTimes) && refetchTimes > 1) {
            return false;
          } else {
            fetchedMap.set(query.queryHash, (refetchTimes ?? 0) + 1);
            return true;
          }
        },
        cacheTime: 1000 * 60 * 60 * 24 * 7, // One week,
      },
    },
  },
  clientPersister: (queryClient) => {
    return persistQueryClient({
      queryClient,
      // IndexedDB rather than localStorage: no ~5MB quota (which a large
      // club's cached lists could exceed, silently disabling persistence)
      // and no synchronous main-thread JSON serialization on every change.
      persister: createAsyncStoragePersister({
        storage: {
          getItem: async (key: string) => (await get<string>(key)) ?? null,
          setItem: (key: string, value: string) => set(key, value),
          removeItem: (key: string) => del(key),
        },
      }),
      maxAge: 1000 * 60 * 60 * 24 * 7, // One week
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => query.queryKey[0] !== "user",
      },
    });
  },
};

createApp(App)
  .component("v-avatar", VAvatar)
  .component("v-backdrop", VBackdrop)
  .component("v-btn", VBtn)
  .component("v-select", VSelect)
  .component("v-switch", VSwitch)
  .component("loading-spinner", Loading)
  .component("movie-table", VTable)
  .component("menu-card", MenuCard)
  .component("v-modal", VModal)
  .component("page-header", PageHeader)
  .component("empty-state", EmptyState)
  // Registered by name so VueDraggableNext's `component` prop can resolve it
  // and render the TransitionGroup as its own root element (see ListItems).
  .component("DraggableTransitionGroup", TransitionGroup)
  .directive("lazy-load", LazyLoad)
  .directive("reveal", Reveal)
  .use(mdiVue, {
    icons,
  })
  .use(Toast, {
    position: "bottom-center",
    hideProgressBar: true,
    bodyClassName: "font-default",
    transition: "Vue-Toastification__fade",
    timeout: 3000,
  })
  .use(VueQueryPlugin, vueQueryOptions)
  .use(createPinia())
  .use(router)
  .mount("#app");
