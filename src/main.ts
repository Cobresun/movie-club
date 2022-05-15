import { createApp } from "vue";
import App from "@/App.vue";
import router from "./router";
import store from "./store";

import mdiVue from "mdi-vue/v3";
import * as mdijs from "@mdi/js";

import VBtn from "@/components/VBtn.vue";
import VAvatar from "./components/VAvatar.vue";
import Loading from "@/components/LoadingSpinner.vue"
// import Table from "@/components/VTable.vue";
import MenuCard from "@/components/MenuCard.vue";
// import Modal from "@/components/VModal.vue";
import './assets/tailwind.css'

createApp(App)
  .component("v-avatar", VAvatar)
  .component("v-btn", VBtn)
  .component("loading-spinner", Loading)
  // .component("movie-table", Table)
  .component("menu-card", MenuCard)
  // .component("v-modal", Modal)
  .use(mdiVue, {
    icons: mdijs
  })
  .use(store)
  .use(router)
  .mount('#app');