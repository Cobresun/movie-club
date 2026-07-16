import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { VueQueryPlugin, VueQueryPluginOptions } from "@tanstack/vue-query";
import { del, get, set } from "idb-keyval";
import mdiVue from "mdi-vue/v3";
import { createPinia } from "pinia";
import { createApp, TransitionGroup } from "vue";
import Toast from "vue-toastification";

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

const vueQueryOptions: VueQueryPluginOptions = {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        // Serve cached data without a network refetch for a minute; mutations
        // invalidate their keys explicitly, so navigating between pages stays
        // instant instead of re-firing every query on each mount.
        staleTime: 1000 * 60,
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
