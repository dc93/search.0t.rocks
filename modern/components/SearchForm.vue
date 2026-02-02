<script setup lang="ts">
import { ref } from 'vue'
import { useSearch, QUERY_OPTIONS, QUERY_FIELD_MAP } from '~/composables/useSearch'

const { queries, exact, maxQueries, addQuery, removeQuery, hasValidQuery, navigateToResults } = useSearch()

const isSearching = ref(false)
const snackbar = ref(false)
const snackbarText = ref('')

async function onSubmit() {
  if (!hasValidQuery()) {
    snackbarText.value = 'Enter at least one search value.'
    snackbar.value = true
    return
  }
  isSearching.value = true
  try {
    await navigateToResults()
  } finally {
    isSearching.value = false
  }
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-icon size="20" color="primary" class="mr-2">mdi-filter-variant</v-icon>
      <span style="font-weight: 500; font-size: 0.9rem; color: #e2e8f0">Query Builder</span>
      <v-spacer />
      <v-checkbox
        v-model="exact"
        label="Exact match"
        density="compact"
        hide-details
        color="primary"
        style="flex: none"
      />
    </div>

    <div
      v-for="(query, idx) in queries"
      :key="idx"
      class="d-flex align-center mb-2"
      style="gap: 8px"
    >
      <v-btn
        v-if="idx === 0"
        icon
        size="x-small"
        variant="tonal"
        color="primary"
        @click="addQuery"
        :disabled="queries.length >= maxQueries"
      >
        <v-icon size="16">mdi-plus</v-icon>
      </v-btn>
      <v-btn
        v-else
        icon
        size="x-small"
        variant="tonal"
        color="error"
        @click="removeQuery(idx)"
      >
        <v-icon size="16">mdi-minus</v-icon>
      </v-btn>

      <v-select
        v-model="query.field"
        :items="[...QUERY_OPTIONS]"
        hide-details
        style="max-width: 180px"
      />

      <v-chip
        :variant="query.not ? 'flat' : 'outlined'"
        :color="query.not ? 'error' : undefined"
        size="small"
        @click="query.not = !query.not"
        style="cursor: pointer; min-width: 52px; justify-content: center"
      >
        NOT
      </v-chip>

      <v-text-field
        v-model="query.value"
        hide-details
        :placeholder="`Enter ${query.field.toLowerCase()}...`"
        @keyup.enter="onSubmit"
        class="flex-grow-1"
      />

      <v-chip
        v-if="query.field === 'Password'"
        :variant="query.extendedSearch ? 'flat' : 'outlined'"
        :color="query.extendedSearch ? 'warning' : undefined"
        size="small"
        @click="query.extendedSearch = !query.extendedSearch"
        style="cursor: pointer"
      >
        <v-icon start size="14">mdi-key-variant</v-icon>
        Hash
      </v-chip>

      <v-btn
        v-if="idx === 0"
        color="primary"
        @click="onSubmit"
        :loading="isSearching"
        style="min-width: 100px"
      >
        <v-icon start size="18">mdi-magnify</v-icon>
        Search
      </v-btn>
      <div v-else style="min-width: 100px" />
    </div>

    <v-snackbar v-model="snackbar" :timeout="2000" color="error">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>
