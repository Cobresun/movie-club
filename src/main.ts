import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

import mdiVue from "mdi-vue/v2";
import * as mdijs from "@mdi/js";

import Btn from "@/components/Btn.vue";
import Table from "@/components/Table.vue";

Vue.config.productionTip = false;
Vue.component("btn", Btn);
Vue.component("movie-table", Table);

Vue.use(mdiVue, {
  icons: mdijs
})
new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount("#app");
