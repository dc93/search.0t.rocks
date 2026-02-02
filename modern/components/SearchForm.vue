<script setup lang="ts">
import { useSearch, QUERY_OPTIONS, QUERY_FIELD_MAP } from '~/composables/useSearch'

const { queries, exact, maxQueries, addQuery, removeQuery, navigateToResults } = useSearch()

function onSubmit() {
  navigateToResults()
}
</script>

<template>
  <v-card variant="flat" color="transparent">
    <v-row align="center" class="mb-2">
      <v-col cols="12" md="3">
        <h4>Search Something...</h4>
      </v-col>
      <v-col cols="12" md="2">
        <v-checkbox v-model="exact" label="Exact match" density="compact" hide-details />
      </v-col>
      <v-col />
    </v-row>

    <v-row
      v-for="(query, idx) in queries"
      :key="idx"
      align="center"
      dense
      class="mb-1"
    >
      <!-- Add/Remove button -->
      <v-col cols="1" class="d-flex justify-center">
        <v-btn
          v-if="idx === 0"
          icon
          size="small"
          @click="addQuery"
          :disabled="queries.length >= maxQueries"
        >
          <v-icon>mdi-plus</v-icon>
        </v-btn>
        <v-btn v-else icon size="small" @click="removeQuery(idx)">
          <v-icon>mdi-minus</v-icon>
        </v-btn>
      </v-col>

      <!-- Field selector -->
      <v-col cols="12" md="2">
        <v-select
          v-model="query.field"
          :items="[...QUERY_OPTIONS]"
          hide-details
        />
      </v-col>

      <!-- NOT checkbox -->
      <v-col cols="12" md="1" class="d-none d-md-flex">
        <v-checkbox v-model="query.not" label="NOT" density="compact" hide-details />
      </v-col>

      <!-- Value input -->
      <v-col :md="query.field === 'Password' ? 4 : 6">
        <v-text-field
          v-model="query.value"
          hide-details
          @keyup.enter="onSubmit"
          :placeholder="`Enter ${query.field.toLowerCase()}...`"
        />
      </v-col>

      <!-- Extended search for passwords -->
      <v-col v-if="query.field === 'Password'" md="2">
        <v-checkbox
          v-model="query.extendedSearch"
          label="Extended"
          density="compact"
          hide-details
        />
      </v-col>

      <!-- Search button on first row -->
      <v-col md="2" class="d-flex justify-center">
        <v-btn v-if="idx === 0" icon @click="onSubmit">
          <v-icon>mdi-magnify</v-icon>
        </v-btn>
      </v-col>
    </v-row>
  </v-card>
</template>
