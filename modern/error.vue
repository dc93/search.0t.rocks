<script setup lang="ts">
import { useError } from '#app'

const error = useError()

function handleClearError() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div
    class="d-flex flex-column align-center justify-center"
    style="min-height: 80vh; background: #0a0e17; color: #e2e8f0"
  >
    <v-icon size="64" color="#1e293b" class="mb-4">mdi-alert-circle-outline</v-icon>
    <h1 style="font-size: 3rem; font-weight: 700; color: #3b82f6; letter-spacing: -0.02em" class="mb-2">
      {{ error?.statusCode || 500 }}
    </h1>
    <p style="font-size: 1rem; color: #64748b" class="mb-6">
      {{ error?.statusMessage || 'An unexpected error occurred.' }}
    </p>
    <v-btn color="primary" @click="handleClearError">
      <v-icon start size="18">mdi-arrow-left</v-icon>
      Back to Dashboard
    </v-btn>
  </div>
</template>
