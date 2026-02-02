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

const fieldIcons: Record<string, string> = {
  emails: 'mdi-email-outline', passwords: 'mdi-key-variant', usernames: 'mdi-at',
  phoneNumbers: 'mdi-phone-outline', ips: 'mdi-ip-network-outline',
  firstName: 'mdi-account-outline', lastName: 'mdi-account-outline',
  address: 'mdi-map-marker-outline', city: 'mdi-city-variant-outline',
  country: 'mdi-earth', domain: 'mdi-web',
}
</script>

<template>
  <div>
    <v-btn to="/search" variant="text" size="small" class="mb-4" style="color: #64748b">
      <v-icon start size="16">mdi-arrow-left</v-icon>
      Back to Search
    </v-btn>

    <v-progress-linear v-if="pending" indeterminate color="primary" class="mb-4" rounded />

    <v-alert v-if="error || data?.error" type="error" variant="tonal" class="mb-4">
      {{ data?.message || 'Failed to load record.' }}
    </v-alert>

    <template v-if="data?.record">
      <v-card class="mb-6 glow-blue">
        <div class="pa-5">
          <div class="d-flex align-center mb-4">
            <v-icon color="primary" class="mr-2">mdi-file-document-outline</v-icon>
            <span style="font-weight: 600; font-size: 1.1rem; color: #f1f5f9">Record Report</span>
            <v-spacer />
            <v-btn size="small" variant="tonal" color="primary" :to="`/visualize?id=${id}`">
              <v-icon start size="16">mdi-graph-outline</v-icon>
              Visualize
            </v-btn>
          </div>

          <div class="mono mb-3" style="font-size: 0.8rem; color: #475569">ID: {{ id }}</div>

          <div class="d-flex flex-wrap" style="gap: 4px">
            <div v-for="field in recordFields" :key="field.key" class="field-tag">
              <v-icon size="12" color="#475569">{{ fieldIcons[field.key] || 'mdi-tag-outline' }}</v-icon>
              <span class="field-key">{{ field.key }}</span>
              <span class="field-value">{{ field.value }}</span>
            </div>
          </div>
        </div>
      </v-card>

      <template v-if="data.related && data.related.length > 0">
        <div class="d-flex align-center mb-4">
          <v-icon size="18" color="primary" class="mr-2">mdi-link-variant</v-icon>
          <span style="font-weight: 500; font-size: 0.9rem">Related Records</span>
          <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">{{ data.related.length }}</v-chip>
        </div>

        <v-card
          v-for="related in data.related"
          :key="related.id"
          variant="outlined"
          class="mb-3"
          style="border-color: rgba(255,255,255,0.06)"
        >
          <div class="pa-4">
            <div class="d-flex align-center mb-2">
              <NuxtLink :to="`/documents/${related.id}`" class="mono" style="font-size: 0.85rem; color: #3b82f6">
                {{ related.id }}
              </NuxtLink>
              <v-spacer />
              <v-chip v-if="related['similarity score']" size="x-small" color="primary" variant="tonal">
                Score: {{ related['similarity score'] }}
              </v-chip>
            </div>
            <div v-if="related.fields" class="d-flex flex-wrap">
              <span v-for="(field, i) in related.fields" :key="i" class="field-tag">
                <span class="field-key">{{ field.key }}</span>
                <span class="field-value">{{ field.value }}</span>
              </span>
            </div>
          </div>
        </v-card>
      </template>
    </template>
  </div>
</template>
