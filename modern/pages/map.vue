<script setup lang="ts">
// Map page - placeholder for future Leaflet/MapLibre integration
const latLong = ref('')
const distance = ref(0.2)
const results = ref<any[]>([])
const isLoading = ref(false)

async function search() {
  if (!latLong.value) return
  isLoading.value = true
  try {
    const data = await $fetch<any>('/api/spatial', {
      query: { latLong: latLong.value, d: distance.value },
    })
    results.value = data.records || []
  } catch {
    results.value = []
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-h5 mb-6">Geospatial Search</h1>

    <v-card class="mb-6 pa-4">
      <v-row>
        <v-col cols="12" md="5">
          <v-text-field
            v-model="latLong"
            label="Coordinates (lat,long)"
            placeholder="38.81,-90.79"
            prepend-inner-icon="mdi-map-marker"
            @keyup.enter="search"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field
            v-model.number="distance"
            label="Radius (km)"
            type="number"
            step="0.1"
            min="0.1"
            max="1000"
            prepend-inner-icon="mdi-radius"
          />
        </v-col>
        <v-col cols="12" md="2" class="d-flex align-center">
          <v-btn color="primary" block @click="search" :loading="isLoading">
            <v-icon start>mdi-magnify</v-icon>
            Search
          </v-btn>
        </v-col>
      </v-row>
    </v-card>

    <v-chip v-if="results.length" class="mb-4" variant="tonal" size="small">
      {{ results.length }} records found
    </v-chip>

    <RecordCard
      v-for="record in results"
      :key="record.id"
      :record="record"
    />
  </div>
</template>
