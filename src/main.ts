import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

import mdiVue from 'mdi-vue/v3'
import * as mdijs from '@mdi/js'

import Btn from '@/components/Btn.vue'

const app = createApp(App)
  .use(router)
  .use(store)
  .use(mdiVue, {
    icons: mdijs
  })

app.component('btn', Btn)

app.mount('#app')
