import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'sentinel',
      themes: {
        sentinel: {
          dark: true,
          colors: {
            background: '#0a0e17',
            surface: '#111827',
            'surface-variant': '#1a2332',
            'surface-bright': '#1f2d3d',
            primary: '#3b82f6',
            'primary-darken-1': '#2563eb',
            secondary: '#64748b',
            accent: '#06b6d4',
            error: '#ef4444',
            info: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            'on-background': '#e2e8f0',
            'on-surface': '#e2e8f0',
          },
        },
      },
    },
    defaults: {
      VBtn: { variant: 'flat', density: 'default' },
      VTextField: { variant: 'outlined', density: 'compact', color: 'primary' },
      VSelect: { variant: 'outlined', density: 'compact', color: 'primary' },
      VCard: { color: 'surface', rounded: 'lg' },
      VChip: { rounded: 'lg' },
      VDataTable: { density: 'comfortable' },
    },
  })

  app.vueApp.use(vuetify)
})
