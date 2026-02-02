<script setup lang="ts">
const config = useRuntimeConfig()

const examples = [
  { label: 'Troy Hunt', params: 'firstName=Troy&lastName=Hunt', icon: 'mdi-account' },
  { label: 'larrytsantos@yahoo.com', params: 'emails=larrytsantos@yahoo.com', icon: 'mdi-email-outline' },
  { label: 'Oni', params: 'usernames=Oni', icon: 'mdi-at' },
  { label: 'KJG7920', params: 'VRN=kjg7920', icon: 'mdi-car' },
]
</script>

<template>
  <div>
    <div class="page-header">
      <div class="page-title">Intelligence Search</div>
      <div class="page-subtitle">
        Query across {{ config.public.recordCount }} indexed records
      </div>
    </div>

    <v-card class="search-panel pa-6 mb-6" rounded="lg">
      <SearchForm />
    </v-card>

    <div class="d-flex align-center mb-3" style="gap: 8px">
      <v-icon size="16" color="#475569">mdi-lightning-bolt</v-icon>
      <span style="font-size: 0.75rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: #475569">
        Example Queries
      </span>
    </div>

    <div class="d-flex flex-wrap" style="gap: 8px">
      <v-chip
        v-for="example in examples"
        :key="example.params"
        :to="`/records?${example.params}`"
        :prepend-icon="example.icon"
        variant="outlined"
        size="small"
        style="border-color: rgba(59,130,246,0.15); color: #94a3b8"
      >
        <span class="mono">{{ example.label }}</span>
      </v-chip>
    </div>
  </div>
</template>
