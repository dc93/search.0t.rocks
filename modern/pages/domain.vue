<script setup lang="ts">
import { ref, computed } from 'vue'

const route = useRoute()
const router = useRouter()

const domainInput = ref((route.query.domain as string) || '')
const dedupEnabled = ref(true)
const page = ref(parseInt(route.query.page as string || '1', 10))

interface DomainResponse {
  domain: string
  stats: {
    totalRecords: number
    uniqueEmails: number
    uniqueUsernames: number
    withPasswords: number
    passwordExposureRate: number
    topSources: { source: string; count: number }[]
  }
  records: Record<string, unknown>[]
  page: number
  perPage: number
  totalPages: number
  error?: boolean
  message?: string
}

const queryParams = computed(() => ({
  domain: route.query.domain || '',
  page: page.value,
  dedup: dedupEnabled.value ? 'true' : undefined,
}))

const { data, pending, refresh } = await useFetch<DomainResponse>('/api/domain', {
  query: queryParams,
  immediate: !!route.query.domain,
})

function search() {
  if (!domainInput.value.trim()) return
  page.value = 1
  router.push({ query: { domain: domainInput.value.trim(), dedup: dedupEnabled.value ? 'true' : undefined } })
  refresh()
}

function goToPage(p: number) {
  page.value = p
  router.replace({ query: { ...route.query, page: String(p) } })
  refresh()
}

function toggleDedup() {
  dedupEnabled.value = !dedupEnabled.value
  page.value = 1
  refresh()
}

const fieldPairs = (record: Record<string, unknown>) =>
  Object.entries(record)
    .filter(([k]) => !['id', '_version_'].includes(k))
    .map(([k, v]) => ({ key: k, value: String(v) }))

const riskColor = computed(() => {
  const rate = data.value?.stats?.passwordExposureRate ?? 0
  if (rate >= 75) return '#ef4444'
  if (rate >= 40) return '#f59e0b'
  return '#10b981'
})
</script>

<template>
  <div>
    <div class="page-header">
      <div class="page-title">Domain Intelligence</div>
      <div class="page-subtitle">Analyze exposed credentials for any domain</div>
    </div>

    <!-- Search -->
    <v-card class="search-panel pa-4 mb-6" rounded="lg">
      <v-row align="center">
        <v-col cols="12" md="7">
          <v-text-field
            v-model="domainInput"
            label="Domain"
            placeholder="example.com"
            prepend-inner-icon="mdi-web"
            hint="Enter a domain name to find all associated credentials"
            persistent-hint
            @keyup.enter="search"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-btn color="primary" block @click="search" :loading="pending">
            <v-icon start size="18">mdi-shield-search</v-icon>
            Analyze Domain
          </v-btn>
        </v-col>
        <v-col cols="12" md="2">
          <v-chip
            :variant="dedupEnabled ? 'flat' : 'outlined'"
            :color="dedupEnabled ? 'primary' : undefined"
            size="small"
            @click="toggleDedup"
            style="cursor: pointer"
          >
            <v-icon start size="14">mdi-filter-remove-outline</v-icon>
            Dedup
          </v-chip>
        </v-col>
      </v-row>
    </v-card>

    <v-progress-linear v-if="pending" indeterminate color="primary" class="mb-4" rounded />

    <template v-if="data && !data.error && data.domain">
      <!-- Stats Row -->
      <v-row class="mb-6">
        <v-col cols="6" sm="3">
          <v-card class="stat-card pa-4" style="--stat-color: #3b82f6">
            <v-icon class="stat-icon" style="color: #3b82f6">mdi-database-outline</v-icon>
            <div class="stat-label mb-2">Total Records</div>
            <div class="stat-value" style="color: #3b82f6">{{ data.stats.totalRecords.toLocaleString() }}</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card class="stat-card pa-4" style="--stat-color: #06b6d4">
            <v-icon class="stat-icon" style="color: #06b6d4">mdi-email-outline</v-icon>
            <div class="stat-label mb-2">Unique Emails</div>
            <div class="stat-value" style="color: #06b6d4">{{ data.stats.uniqueEmails.toLocaleString() }}</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card class="stat-card pa-4" style="--stat-color: #8b5cf6">
            <v-icon class="stat-icon" style="color: #8b5cf6">mdi-at</v-icon>
            <div class="stat-label mb-2">Unique Usernames</div>
            <div class="stat-value" style="color: #8b5cf6">{{ data.stats.uniqueUsernames.toLocaleString() }}</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card class="stat-card pa-4" :style="{ '--stat-color': riskColor }">
            <v-icon class="stat-icon" :style="{ color: riskColor }">mdi-key-variant</v-icon>
            <div class="stat-label mb-2">Password Exposure</div>
            <div class="stat-value" :style="{ color: riskColor }">{{ data.stats.passwordExposureRate }}%</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Source Breakdown -->
      <v-row class="mb-6" v-if="data.stats.topSources.length > 0">
        <v-col cols="12">
          <v-card class="pa-4">
            <div class="d-flex align-center mb-3">
              <v-icon size="18" color="primary" class="mr-2">mdi-source-branch</v-icon>
              <span style="font-weight: 500; font-size: 0.875rem">Breach Sources</span>
            </div>
            <div class="d-flex flex-wrap" style="gap: 8px">
              <v-chip
                v-for="src in data.stats.topSources"
                :key="src.source"
                variant="tonal"
                color="error"
                size="small"
              >
                <span class="mono">{{ src.source }}</span>
                <v-badge :content="src.count.toLocaleString()" inline color="error" />
              </v-chip>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Records -->
      <div class="d-flex align-center mb-4">
        <v-icon size="18" color="primary" class="mr-2">mdi-format-list-bulleted</v-icon>
        <span style="font-weight: 500; font-size: 0.875rem">Exposed Credentials</span>
        <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">
          Page {{ data.page }} of {{ data.totalPages }}
        </v-chip>
      </div>

      <v-card
        v-for="record in data.records"
        :key="(record as any).id"
        variant="outlined"
        class="mb-3"
        style="border-color: rgba(255,255,255,0.06)"
        hover
      >
        <div class="pa-4">
          <div class="d-flex align-center mb-3">
            <v-icon size="16" color="primary" class="mr-2">mdi-file-document-outline</v-icon>
            <NuxtLink
              :to="`/documents/${(record as any).id}`"
              class="mono"
              style="font-size: 0.85rem; color: #3b82f6"
            >
              {{ (record as any).id }}
            </NuxtLink>
            <v-spacer />
            <v-btn size="x-small" variant="tonal" color="primary" :to="`/visualize?id=${(record as any).id}`">
              <v-icon size="14" start>mdi-graph-outline</v-icon>
              Graph
            </v-btn>
          </div>
          <div class="d-flex flex-wrap">
            <span v-for="(field, i) in fieldPairs(record)" :key="i" class="field-tag">
              <span class="field-key">{{ field.key }}</span>
              <span class="field-value">{{ field.value }}</span>
            </span>
          </div>
        </div>
      </v-card>

      <v-alert v-if="data.records.length === 0" type="info" variant="tonal">
        No records found for this domain.
      </v-alert>

      <div v-if="data.totalPages > 1" class="d-flex justify-center mt-6">
        <v-pagination
          :model-value="data.page"
          @update:model-value="goToPage"
          :length="data.totalPages"
          :total-visible="7"
          rounded
          color="primary"
        />
      </div>
    </template>

    <!-- Empty state -->
    <v-card v-else-if="!pending && !data?.domain" class="pa-8 text-center">
      <v-icon size="64" color="#1e293b" class="mb-4">mdi-web</v-icon>
      <div style="font-size: 0.9rem; color: #64748b">Enter a domain to view all exposed credentials</div>
      <div style="font-size: 0.75rem; color: #334155" class="mt-2">
        Examples: google.com, adobe.com, linkedin.com
      </div>
    </v-card>
  </div>
</template>
