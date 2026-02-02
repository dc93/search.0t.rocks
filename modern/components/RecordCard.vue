<script setup lang="ts">
import { computed } from 'vue'
import type { SolrRecord } from '~/types'

const props = defineProps<{
  record: SolrRecord & { fields?: string[]; canMap?: boolean }
}>()

const displayFields = computed(() => {
  if (props.record.fields) return props.record.fields
  return Object.entries(props.record)
    .filter(([key]) => !['id', '_version_', 'fields', 'canMap'].includes(key))
    .map(([key, value]) => `${key}: ${value}`)
})
</script>

<template>
  <v-card class="mb-3" variant="outlined">
    <v-card-title class="d-flex align-center text-body-2">
      <NuxtLink :to="`/documents/${record.id}`" class="text-primary">
        {{ record.id }}
      </NuxtLink>
      <v-spacer />
      <v-btn
        size="x-small"
        variant="text"
        :to="`/visualize?id=${record.id}`"
        class="text-secondary"
      >
        <v-icon size="small">mdi-graph</v-icon>
        Visualize
      </v-btn>
    </v-card-title>

    <v-card-text>
      <div v-for="(field, i) in displayFields" :key="i" class="text-body-2 py-0">
        {{ field }}
      </div>
    </v-card-text>
  </v-card>
</template>
