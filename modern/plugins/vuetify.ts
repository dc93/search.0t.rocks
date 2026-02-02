import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'dark',
      themes: {
        dark: {
          dark: true,
          colors: {
            background: '#121212',
            surface: '#1E1E1E',
            primary: '#82B1FF',
            secondary: '#B0BEC5',
            accent: '#448AFF',
            error: '#FF5252',
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FFC107',
          },
        },
      },
    },
    defaults: {
      VBtn: { variant: 'text' },
      VTextField: { variant: 'outlined', density: 'compact' },
      VSelect: { variant: 'outlined', density: 'compact' },
    },
  })

  app.vueApp.use(vuetify)
})
