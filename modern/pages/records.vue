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

// Pagination
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
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">Search Results</h1>
      <v-spacer />
      <v-btn variant="outlined" size="small" :to="`/exports?url=${encodeURIComponent($route.fullPath)}`">
        <v-icon start size="small">mdi-download</v-icon>
        Export More
      </v-btn>
    </div>

    <v-progress-linear v-if="pending" indeterminate color="primary" class="mb-4" />

    <v-alert v-if="error" type="error" class="mb-4">
      Failed to load results. Please try again.
    </v-alert>

    <template v-if="data && !data.error">
      <v-chip class="mb-4" variant="tonal" size="small">
        {{ data.resultCount.toLocaleString() }} total hits &mdash;
        {{ data.count }} shown
      </v-chip>

      <RecordCard
        v-for="record in paginatedRecords"
        :key="record.id"
        :record="record"
      />

      <v-alert v-if="data.records.length === 0" type="info" variant="outlined">
        No records found for this query.
      </v-alert>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="d-flex justify-center mt-6">
        <v-pagination
          v-model="page"
          :length="totalPages"
          :total-visible="7"
          rounded
        />
      </div>
    </template>

    <v-alert v-else-if="data?.error" type="warning" variant="outlined">
      {{ data.message }}
    </v-alert>
  </div>
</template>
