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
    style="min-height: 80vh; background: #121212; color: #fff"
  >
    <h1 class="text-h2 font-weight-bold mb-4">
      {{ error?.statusCode || 500 }}
    </h1>
    <p class="text-h6 text-grey mb-6">
      {{ error?.statusMessage || 'An unexpected error occurred.' }}
    </p>
    <v-btn color="primary" variant="tonal" @click="handleClearError">
      <v-icon start>mdi-home</v-icon>
      Back to Home
    </v-btn>
  </div>
</template>
