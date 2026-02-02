<script setup lang="ts">
const config = useRuntimeConfig()

const examples = [
  { label: 'Name: Troy Hunt', params: 'firstName=Troy&lastName=Hunt' },
  { label: 'Email: larrytsantos@yahoo.com', params: 'emails=larrytsantos@yahoo.com' },
  { label: 'Username: Oni', params: 'usernames=Oni' },
  { label: 'License Plate: KJG7920', params: 'VRN=kjg7920' },
]
</script>

<template>
  <div>
    <div class="text-center mb-8" style="margin-top: 5%">
      <h1 class="text-h3 font-weight-bold mb-2">Records Search</h1>
      <h2 class="text-h5 text-grey mb-2">
        {{ config.public.recordCount }} Records in DB
      </h2>
    </div>

    <SearchForm />

    <v-divider class="my-8" />

    <div>
      <p class="text-subtitle-2 text-grey mb-2">Example Queries:</p>
      <div class="d-flex flex-wrap gap-2">
        <v-chip
          v-for="example in examples"
          :key="example.params"
          :to="`/records?${example.params}`"
          variant="outlined"
          size="small"
        >
          {{ example.label }}
        </v-chip>
      </div>
    </div>
  </div>
</template>
