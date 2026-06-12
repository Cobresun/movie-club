import * as mdijs from "@mdi/js";
import { createTestingPinia } from "@pinia/testing";
import { VueQueryPlugin } from "@tanstack/vue-query";
import userEvent from "@testing-library/user-event";
import {
  RenderOptions,
  render as testingLibraryRender,
} from "@testing-library/vue";
import mdiVue from "mdi-vue/v3";
import Toast from "vue-toastification";

import PiniaStoreHelperTest from "./PiniaStoreHelper.test.vue";

import EmptyState from "@/common/components/EmptyState.vue";
import LoadingSpinner from "@/common/components/LoadingSpinner.vue";
import PageHeader from "@/common/components/PageHeader.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import VBackdrop from "@/common/components/VBackdrop.vue";
import VBtn from "@/common/components/VBtn.vue";
import VModal from "@/common/components/VModal.vue";
import VSelect from "@/common/components/VSelect.vue";
import VSwitch from "@/common/components/VSwitch.vue";
import VTable from "@/common/components/VTable.vue";
import LazyLoad from "@/directives/LazyLoad";
import MenuCard from "@/features/clubs/components/MenuCard.vue";

export const render = <C>(
  component: C,
  options: Partial<RenderOptions<C>> = {},
) => {
  const user = userEvent.setup();
  const pinia = createTestingPinia();
  testingLibraryRender(PiniaStoreHelperTest, {
    global: { plugins: [VueQueryPlugin, pinia] },
  });
  return {
    ...testingLibraryRender(component, {
      ...options,
      global: {
        ...options.global,
        components: {
          // Mirror the global components registered in src/main.ts so view
          // tests render real markup instead of unresolved custom elements.
          "v-avatar": VAvatar,
          "v-backdrop": VBackdrop,
          "v-btn": VBtn,
          "v-select": VSelect,
          "v-switch": VSwitch,
          "empty-state": EmptyState,
          "loading-spinner": LoadingSpinner,
          "menu-card": MenuCard,
          "movie-table": VTable,
          "v-modal": VModal,
          "page-header": PageHeader,
          ...options.global?.components,
        },
        plugins: [
          // Disable query retries so error-path tests surface the error state
          // immediately instead of racing the default 3× exponential backoff.
          [
            VueQueryPlugin,
            {
              queryClientConfig: {
                defaultOptions: { queries: { retry: false } },
              },
            },
          ],
          pinia,
          [mdiVue, { icons: mdijs }],
          Toast,
        ],
        directives: { "lazy-load": LazyLoad },
        stubs: ["router-link", "router-view"],
      },
    }),
    user,
    pinia,
  };
};
