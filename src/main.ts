import * as mdijs from "@mdi/js";
import mdiVue from "mdi-vue/v3";
import { createPinia } from "pinia";
import { createApp } from "vue";
import Toast from "vue-toastification";

import LazyLoad from "./directives/LazyLoad";
import router from "./router";

import App from "@/App.vue";
import Loading from "@/common/components/LoadingSpinner.vue";
import PageHeader from "@/common/components/PageHeader.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import VBtn from "@/common/components/VBtn.vue";
import VModal from "@/common/components/VModal.vue";
import VTable from "@/common/components/VTable.vue";
import MenuCard from "@/features/clubs/components/MenuCard.vue";

import "./assets/styles/tailwind.css";
import "animate.css";
import "vue-toastification/dist/index.css";

createApp(App)
  .component("v-avatar", VAvatar)
  .component("v-btn", VBtn)
  .component("loading-spinner", Loading)
  .component("movie-table", VTable)
  .component("menu-card", MenuCard)
  .component("v-modal", VModal)
  .component("page-header", PageHeader)
  .directive("lazy-load", LazyLoad)
  .use(mdiVue, {
    icons: mdijs,
  })
  .use(Toast, {
    position: "bottom-center",
    hideProgressBar: true,
    bodyClassName: "font-default",
  })
  .use(createPinia())
  .use(router)
  .mount("#app");
