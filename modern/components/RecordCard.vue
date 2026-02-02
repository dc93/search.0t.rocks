<script setup lang="ts">
import { computed } from 'vue'
import type { SolrRecord } from '~/types'

const props = defineProps<{
  record: SolrRecord & { fields?: string[]; canMap?: boolean }
}>()

const HIDDEN_KEYS = ['id', '_version_', 'fields', 'canMap']

const fieldPairs = computed(() => {
  if (props.record.fields) {
    return props.record.fields.map((f) => {
      const idx = f.indexOf(': ')
      return idx > 0
        ? { key: f.substring(0, idx), value: f.substring(idx + 2) }
        : { key: '', value: f }
    })
  }
  return Object.entries(props.record)
    .filter(([key]) => !HIDDEN_KEYS.includes(key))
    .map(([key, value]) => ({ key, value: String(value) }))
})
</script>

<template>
  <v-card
    class="mb-3"
    variant="outlined"
    style="border-color: rgba(255,255,255,0.06)"
    hover
  >
    <div class="pa-4">
      <div class="d-flex align-center mb-3">
        <v-icon size="16" color="primary" class="mr-2">mdi-file-document-outline</v-icon>
        <NuxtLink
          :to="`/documents/${record.id}`"
          class="mono"
          style="font-size: 0.85rem; color: #3b82f6"
        >
          {{ record.id }}
        </NuxtLink>
        <v-spacer />
        <v-btn
          size="x-small"
          variant="tonal"
          color="primary"
          :to="`/visualize?id=${record.id}`"
        >
          <v-icon size="14" start>mdi-graph-outline</v-icon>
          Graph
        </v-btn>
      </div>

      <div class="d-flex flex-wrap">
        <span v-for="(field, i) in fieldPairs" :key="i" class="field-tag">
          <span v-if="field.key" class="field-key">{{ field.key }}</span>
          <span class="field-value">{{ field.value }}</span>
        </span>
      </div>
    </div>
  </v-card>
</template>
