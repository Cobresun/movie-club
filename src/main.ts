import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

import mdiVue from "mdi-vue/v2";
import * as mdijs from "@mdi/js";

import Avatar from "vue-avatar-component";
import Btn from "@/components/Btn.vue";
import Loading from "@/components/Loading.vue"
import Table from "@/components/Table.vue";
import MenuCard from "@/components/MenuCard.vue";
import Modal from "@/components/Modal.vue";
import './assets/tailwind.css'

Vue.config.productionTip = false;

Vue.component("avatar", Avatar);
Vue.component("btn", Btn);
Vue.component("loading-spinner", Loading);
Vue.component("movie-table", Table);
Vue.component("menu-card", MenuCard);
Vue.component("modal", Modal);

Vue.use(mdiVue, {
  icons: mdijs
})
new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount("#app");
