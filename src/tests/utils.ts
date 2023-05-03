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

import LoadingSpinner from "@/common/components/LoadingSpinner.vue";
import PageHeader from "@/common/components/PageHeader.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import VBtn from "@/common/components/VBtn.vue";
import VModal from "@/common/components/VModal.vue";
import VTable from "@/common/components/VTable.vue";
import LazyLoad from "@/directives/LazyLoad";

export const render = (
  component: unknown,
  options: Partial<RenderOptions> = {}
) => {
  const user = userEvent.setup();
  const pinia = createTestingPinia();
  return {
    ...testingLibraryRender(component, {
      ...options,
      global: {
        ...options.global,
        components: {
          "v-avatar": VAvatar,
          "v-btn": VBtn,
          "loading-spinner": LoadingSpinner,
          "movie-table": VTable,
          "v-modal": VModal,
          "page-header": PageHeader,
        },
        plugins: [VueQueryPlugin, pinia, [mdiVue, { icons: mdijs }], Toast],
        directives: { "lazy-load": LazyLoad },
        stubs: ["router-link", "router-view"],
      },
    }),
    user,
    pinia,
  };
};
