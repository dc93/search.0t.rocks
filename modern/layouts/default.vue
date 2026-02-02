<script setup lang="ts">
const navItems = [
  { title: 'Search', to: '/', icon: 'mdi-magnify' },
  { title: 'Map', to: '/map', icon: 'mdi-map' },
  { title: 'Exports', to: '/exports', icon: 'mdi-download' },
  { title: 'Donations', to: '/donations', icon: 'mdi-heart' },
  { title: 'FAQ', to: '/faq', icon: 'mdi-help-circle' },
]
</script>

<template>
  <v-app>
    <v-app-bar flat color="transparent">
      <v-app-bar-title>
        <NuxtLink to="/" class="text-white text-decoration-none font-weight-bold">
          Database Search
        </NuxtLink>
      </v-app-bar-title>

      <template #append>
        <div class="d-none d-md-flex align-center mr-2">
          <v-btn
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            variant="text"
            size="small"
            class="text-white"
          >
            <v-icon start size="small">{{ item.icon }}</v-icon>
            {{ item.title }}
          </v-btn>
        </div>
        <WalletToolbar />
      </template>
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-4 pa-md-8">
        <slot />
      </v-container>
    </v-main>

    <v-footer app class="text-center text-caption pa-4" color="transparent">
      <div class="w-100">
        <NuxtLink to="/terms" class="text-secondary mx-2">Terms</NuxtLink>
        <NuxtLink to="/faq" class="text-secondary mx-2">FAQ</NuxtLink>
        <NuxtLink to="/canary" class="text-secondary mx-2">Canary</NuxtLink>
      </div>
    </v-footer>
  </v-app>
</template>
