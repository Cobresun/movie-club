import * as mdijs from "@mdi/js";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { VueQueryPlugin, VueQueryPluginOptions } from "@tanstack/vue-query";
import mdiVue from "mdi-vue/v3";
import { createPinia } from "pinia";
import { createApp, reactive } from "vue";
import Toast from "vue-toastification";

import LazyLoad from "./directives/LazyLoad";
import router from "./router";
import { isDefined } from "../lib/checks/checks.js";

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
import "animate.css";
import "vue-toastification/dist/index.css";

const fetchedMap = reactive(new Map<string, number>());

const vueQueryOptions: VueQueryPluginOptions = {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnMount: (query) => {
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
      persister: createSyncStoragePersister({ storage: localStorage }),
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
  .directive("lazy-load", LazyLoad)
  .use(mdiVue, {
    icons: mdijs,
  })
  .use(Toast, {
    position: "bottom-center",
    hideProgressBar: true,
    bodyClassName: "font-default",
  })
  .use(VueQueryPlugin, vueQueryOptions)
  .use(createPinia())
  .use(router)
  .mount("#app");
