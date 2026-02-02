<script setup lang="ts">
const drawer = ref(true)
const miniVariant = ref(false)
const route = useRoute()

const navSections = [
  {
    title: 'Intelligence',
    items: [
      { title: 'Dashboard', to: '/', icon: 'mdi-view-dashboard-outline' },
      { title: 'Search', to: '/search', icon: 'mdi-magnify' },
      { title: 'Geospatial', to: '/map', icon: 'mdi-earth' },
      { title: 'Graph Explorer', to: '/visualize', icon: 'mdi-graph-outline' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { title: 'Exports', to: '/exports', icon: 'mdi-database-export-outline' },
      { title: 'Donations', to: '/donations', icon: 'mdi-hand-heart-outline' },
    ],
  },
  {
    title: 'System',
    items: [
      { title: 'FAQ', to: '/faq', icon: 'mdi-help-circle-outline' },
      { title: 'Terms', to: '/terms', icon: 'mdi-file-document-outline' },
      { title: 'Canary', to: '/canary', icon: 'mdi-shield-check-outline' },
    ],
  },
]
</script>

<template>
  <v-app>
    <!-- Top Bar -->
    <v-app-bar
      flat
      height="56"
      style="background: rgba(10, 14, 23, 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(59, 130, 246, 0.08)"
    >
      <v-app-bar-nav-icon
        @click="drawer = !drawer"
        color="#64748b"
      />

      <div class="d-flex align-center ml-1">
        <v-icon color="primary" size="24" class="mr-2">mdi-shield-search</v-icon>
        <span style="font-weight: 600; font-size: 1rem; letter-spacing: -0.01em; color: #f1f5f9">
          SENTINEL
        </span>
        <v-chip
          size="x-small"
          color="primary"
          variant="tonal"
          class="ml-2"
          style="font-size: 0.6rem; font-weight: 600; letter-spacing: 0.05em"
        >
          TI PLATFORM
        </v-chip>
      </div>

      <v-spacer />

      <!-- Status indicator -->
      <div class="d-none d-md-flex align-center mr-4" style="gap: 8px">
        <span class="pulse-dot" />
        <span style="font-size: 0.75rem; color: #64748b">Systems Online</span>
      </div>

      <WalletToolbar />
    </v-app-bar>

    <!-- Sidebar -->
    <v-navigation-drawer
      v-model="drawer"
      :rail="miniVariant"
      permanent
      class="app-sidebar"
      width="240"
    >
      <div style="height: 56px" />

      <template v-for="(section, si) in navSections" :key="si">
        <div
          v-if="!miniVariant"
          class="px-5 pt-4 pb-1"
          style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #475569"
        >
          {{ section.title }}
        </div>
        <v-divider v-else class="mx-3 my-2" style="border-color: rgba(255,255,255,0.04)" />

        <v-list density="compact" nav>
          <v-list-item
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            :active="route.path === item.to"
            :prepend-icon="item.icon"
            :title="item.title"
          />
        </v-list>
      </template>

      <!-- Bottom toggle -->
      <template #append>
        <div class="pa-2" style="border-top: 1px solid rgba(255,255,255,0.04)">
          <v-btn
            block
            variant="text"
            size="small"
            @click="miniVariant = !miniVariant"
            style="color: #475569"
          >
            <v-icon>{{ miniVariant ? 'mdi-chevron-right' : 'mdi-chevron-left' }}</v-icon>
            <span v-if="!miniVariant" class="ml-2" style="font-size: 0.75rem">Collapse</span>
          </v-btn>
        </div>
      </template>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main>
      <div class="pa-4 pa-md-6" style="max-width: 1400px">
        <slot />
      </div>
    </v-main>
  </v-app>
</template>
