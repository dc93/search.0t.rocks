import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  build: {
    transpile: ['vuetify'],
  },

  modules: [
    (_options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        config.plugins!.push(vuetify({ autoImport: true }))
      })
    },
  ],

  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
  },

  css: ['@mdi/font/css/materialdesignicons.min.css', '~/assets/main.scss'],

  runtimeConfig: {
    solrServers: ['http://solr1:8983/solr/BigData/select'],
    redisUrl: 'redis://redis:6379',
    public: {
      recordCount: '14,491,682,918',
      contactEmail: 'miyakoyakota@riseup.com',
    },
  },

  nitro: {
    storage: {
      rateLimit: { driver: 'memory' },
    },
  },

  app: {
    head: {
      title: 'Database Search',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#121212' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
})
