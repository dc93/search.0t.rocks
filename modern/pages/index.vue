<script setup lang="ts">
const config = useRuntimeConfig()

const stats = [
  { label: 'Total Records', value: config.public.recordCount, icon: 'mdi-database-outline', color: '#3b82f6' },
  { label: 'Data Sources', value: '2,847', icon: 'mdi-source-branch', color: '#06b6d4' },
  { label: 'Fields Indexed', value: '23', icon: 'mdi-tag-multiple-outline', color: '#10b981' },
  { label: 'Uptime', value: '99.97%', icon: 'mdi-server-outline', color: '#f59e0b' },
]

const quickActions = [
  { title: 'Search Records', subtitle: 'Query across all indexed data', icon: 'mdi-magnify', to: '/search', color: '#3b82f6' },
  { title: 'Geospatial Intel', subtitle: 'Location-based record discovery', icon: 'mdi-earth', to: '/map', color: '#06b6d4' },
  { title: 'Graph Explorer', subtitle: 'Visualize entity relationships', icon: 'mdi-graph-outline', to: '/visualize', color: '#8b5cf6' },
  { title: 'Bulk Export', subtitle: 'Export large result sets', icon: 'mdi-database-export-outline', to: '/exports', color: '#10b981' },
]

const recentSearches = [
  { query: 'Troy Hunt', field: 'firstName', time: '2 min ago' },
  { query: 'larrytsantos@yahoo.com', field: 'emails', time: '15 min ago' },
  { query: 'KJG7920', field: 'VRN', time: '1 hr ago' },
]
</script>

<template>
  <div>
    <div class="page-header d-flex align-center">
      <div>
        <div class="page-title">Threat Intelligence Dashboard</div>
        <div class="page-subtitle">Real-time overview of your intelligence platform</div>
      </div>
      <v-spacer />
      <v-btn color="primary" to="/search" class="mr-2">
        <v-icon start>mdi-magnify</v-icon>
        New Search
      </v-btn>
    </div>

    <!-- Stats -->
    <v-row class="mb-6">
      <v-col v-for="stat in stats" :key="stat.label" cols="12" sm="6" lg="3">
        <v-card class="stat-card pa-4" :style="{ '--stat-color': stat.color }">
          <v-icon class="stat-icon" :style="{ color: stat.color }">{{ stat.icon }}</v-icon>
          <div class="stat-label mb-2">{{ stat.label }}</div>
          <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <!-- Quick Actions -->
      <v-col cols="12" md="8">
        <v-card class="pa-1">
          <v-card-title class="d-flex align-center" style="font-size: 0.875rem; font-weight: 600">
            <v-icon size="18" class="mr-2" color="primary">mdi-lightning-bolt</v-icon>
            Quick Actions
          </v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col v-for="action in quickActions" :key="action.to" cols="12" sm="6">
                <v-card
                  :to="action.to"
                  variant="outlined"
                  class="pa-4 d-flex align-center"
                  style="cursor: pointer; border-color: rgba(255,255,255,0.06)"
                  hover
                >
                  <v-avatar :color="action.color" size="40" variant="tonal" class="mr-3">
                    <v-icon>{{ action.icon }}</v-icon>
                  </v-avatar>
                  <div>
                    <div style="font-weight: 500; font-size: 0.875rem">{{ action.title }}</div>
                    <div style="font-size: 0.75rem; color: #64748b">{{ action.subtitle }}</div>
                  </div>
                  <v-spacer />
                  <v-icon color="#334155" size="18">mdi-chevron-right</v-icon>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Recent Activity -->
      <v-col cols="12" md="4">
        <v-card class="pa-1">
          <v-card-title class="d-flex align-center" style="font-size: 0.875rem; font-weight: 600">
            <v-icon size="18" class="mr-2" color="primary">mdi-history</v-icon>
            Recent Searches
          </v-card-title>
          <v-card-text>
            <div v-for="(item, i) in recentSearches" :key="i" class="d-flex align-center py-3" :style="i > 0 ? 'border-top: 1px solid rgba(255,255,255,0.04)' : ''">
              <v-icon size="16" color="#475569" class="mr-3">mdi-magnify</v-icon>
              <div class="flex-grow-1">
                <div class="mono" style="font-size: 0.85rem; color: #e2e8f0">{{ item.query }}</div>
                <div style="font-size: 0.7rem; color: #475569">{{ item.field }}</div>
              </div>
              <span style="font-size: 0.7rem; color: #475569">{{ item.time }}</span>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn variant="text" size="small" to="/search" block style="color: #3b82f6; font-size: 0.75rem">
              View All Searches
              <v-icon end size="14">mdi-arrow-right</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
