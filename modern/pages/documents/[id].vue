<script setup lang="ts">
import type { SolrRecord } from '~/types'

interface DocumentResponse {
  record: SolrRecord
  related: (SolrRecord & {
    fields?: { key: string; value: unknown }[]
    'similarity score'?: number
  })[]
  error?: boolean
  message?: string
}

const route = useRoute()
const id = route.params.id as string

const { data, pending, error } = await useFetch<DocumentResponse>(`/api/documents/${id}`)

const recordFields = computed(() => {
  if (!data.value?.record) return []
  return Object.entries(data.value.record)
    .filter(([key]) => !['id', '_version_'].includes(key))
    .map(([key, value]) => ({ key, value }))
})
</script>

<template>
  <div>
    <v-btn to="/" variant="text" size="small" class="mb-4">
      <v-icon start>mdi-arrow-left</v-icon>
      Back to Search
    </v-btn>

    <v-progress-linear v-if="pending" indeterminate color="primary" class="mb-4" />

    <v-alert v-if="error || data?.error" type="error" class="mb-4">
      {{ data?.message || 'Failed to load record.' }}
    </v-alert>

    <template v-if="data?.record">
      <v-card class="mb-6">
        <v-card-title class="d-flex align-center">
          <span class="text-h6">Record Report</span>
          <v-spacer />
          <v-btn
            size="small"
            variant="outlined"
            :to="`/visualize?id=${id}`"
          >
            <v-icon start size="small">mdi-graph</v-icon>
            Visualize
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-table density="compact">
            <tbody>
              <tr v-for="field in recordFields" :key="field.key">
                <td class="font-weight-medium text-grey" style="width: 200px">
                  {{ field.key }}
                </td>
                <td>{{ field.value }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>

      <!-- Related Records -->
      <template v-if="data.related && data.related.length > 0">
        <h3 class="text-h6 mb-4">
          Related Records
          <v-chip size="x-small" class="ml-2">{{ data.related.length }}</v-chip>
        </h3>

        <v-card
          v-for="related in data.related"
          :key="related.id"
          variant="outlined"
          class="mb-3"
        >
          <v-card-title class="text-body-2 d-flex align-center">
            <NuxtLink :to="`/documents/${related.id}`" class="text-primary">
              {{ related.id }}
            </NuxtLink>
            <v-spacer />
            <v-chip
              v-if="related['similarity score']"
              size="x-small"
              color="primary"
              variant="tonal"
            >
              Score: {{ related['similarity score'] }}
            </v-chip>
          </v-card-title>
          <v-card-text>
            <div v-if="related.fields" class="text-body-2">
              <div v-for="(field, i) in related.fields" :key="i">
                <strong>{{ field.key }}:</strong> {{ field.value }}
              </div>
            </div>
          </v-card-text>
        </v-card>
      </template>
    </template>
  </div>
</template>
