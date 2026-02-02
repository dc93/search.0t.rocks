<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SolrRecord } from '~/types'

interface RecordsResponse {
  resultCount: number
  count: number
  records: (SolrRecord & { fields?: string[]; canMap?: boolean })[]
  query: string
  error?: boolean
  message?: string
}

const route = useRoute()

const { data, pending, error } = await useFetch<RecordsResponse>('/api/records', {
  query: route.query,
  timeout: 30000,
})

const page = ref(1)
const perPage = 25

const paginatedRecords = computed(() => {
  if (!data.value?.records) return []
  const start = (page.value - 1) * perPage
  return data.value.records.slice(start, start + perPage)
})

const totalPages = computed(() => {
  if (!data.value?.records) return 0
  return Math.ceil(data.value.records.length / perPage)
})
</script>

<template>
  <div>
    <div class="page-header d-flex align-center">
      <div>
        <div class="page-title">Search Results</div>
        <div class="page-subtitle" v-if="data && !data.error">
          {{ data.resultCount.toLocaleString() }} total matches
        </div>
      </div>
      <v-spacer />
      <v-btn variant="tonal" color="primary" size="small" to="/search" class="mr-2">
        <v-icon start size="16">mdi-magnify</v-icon>
        New Search
      </v-btn>
      <v-btn variant="tonal" color="success" size="small" :to="`/exports?url=${encodeURIComponent($route.fullPath)}`">
        <v-icon start size="16">mdi-database-export-outline</v-icon>
        Export
      </v-btn>
    </div>

    <v-progress-linear v-if="pending" indeterminate color="primary" class="mb-4" rounded />

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
      Failed to load results. Please try again.
    </v-alert>

    <template v-if="data && !data.error">
      <div class="d-flex align-center mb-4" style="gap: 12px">
        <v-chip variant="tonal" color="primary" size="small">
          <v-icon start size="14">mdi-database-search</v-icon>
          {{ data.count }} shown
        </v-chip>
        <span style="font-size: 0.75rem; color: #475569" v-if="data.query">
          Query: <span class="mono">{{ data.query }}</span>
        </span>
      </div>

      <RecordCard v-for="record in paginatedRecords" :key="record.id" :record="record" />

      <v-alert v-if="data.records.length === 0" type="info" variant="tonal">
        No records found for this query.
      </v-alert>

      <div v-if="totalPages > 1" class="d-flex justify-center mt-6">
        <v-pagination v-model="page" :length="totalPages" :total-visible="7" rounded color="primary" />
      </div>
    </template>

    <v-alert v-else-if="data?.error" type="warning" variant="tonal">
      {{ data.message }}
    </v-alert>
  </div>
</template>
