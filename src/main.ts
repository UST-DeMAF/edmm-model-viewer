import messages from '@intlify/unplugin-vue-i18n/messages'
import { createHead } from '@unhead/vue/client'
import NProgress from 'nprogress'
import { createPinia } from 'pinia'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from './App.vue'

import '@unocss/reset/tailwind.css'
import './styles/main.css'
import 'uno.css'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const app = createApp(App)

// Setup router
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: setupLayouts(routes),
})

// Setup head management
const head = createHead()

// Setup pinia
const pinia = createPinia()

// Setup i18n
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages,
})

app.use(router)
app.use(head)
app.use(pinia)
app.use(i18n)

// Install nprogress
router.beforeEach(() => {
  NProgress.start()
})
router.afterEach(() => {
  NProgress.done()
})

app.mount('#app')
