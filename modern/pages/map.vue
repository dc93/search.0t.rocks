<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import type { SolrRecord } from '~/types'

const latLong = ref('')
const distance = ref(0.2)
const results = ref<SolrRecord[]>([])
const isLoading = ref(false)
const mapContainer = ref<HTMLElement | null>(null)
const snackbar = ref(false)
const snackbarText = ref('')

let leaflet: typeof import('leaflet') | null = null
let map: any = null
let markerGroup: any = null

async function initMap() {
  if (map || !mapContainer.value) return
  leaflet = await import('leaflet')
  await import('leaflet/dist/leaflet.css')

  map = leaflet.map(mapContainer.value).setView([38.81, -90.79], 5)
  leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  markerGroup = leaflet.layerGroup().addTo(map)

  // Click on map to set coordinates
  map.on('click', (e: any) => {
    latLong.value = `${e.latlng.lat.toFixed(6)},${e.latlng.lng.toFixed(6)}`
  })
}

function plotResults() {
  if (!leaflet || !markerGroup) return
  markerGroup.clearLayers()

  for (const record of results.value) {
    if (!record.latLong) continue
    const [lat, lng] = record.latLong.split(',').map(Number)
    if (isNaN(lat) || isNaN(lng)) continue

    const popupContent = Object.entries(record)
      .filter(([k]) => !['id', '_version_', 'latLong'].includes(k))
      .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
      .join('<br/>')

    leaflet.marker([lat, lng])
      .bindPopup(`<div style="max-height:200px;overflow:auto">${popupContent}</div>`)
      .addTo(markerGroup)
  }

  // Fit bounds if we have markers
  if (results.value.length > 0) {
    const bounds = markerGroup.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }
}

async function search() {
  if (!latLong.value) {
    snackbarText.value = 'Enter coordinates or click on the map.'
    snackbar.value = true
    return
  }
  isLoading.value = true
  try {
    const data = await $fetch<{ numDocs: number; records: SolrRecord[] }>('/api/spatial', {
      query: { latLong: latLong.value, d: distance.value },
    })
    results.value = data.records || []
    plotResults()
  } catch {
    snackbarText.value = 'Search failed. Check coordinates format.'
    snackbar.value = true
    results.value = []
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  initMap()
})
</script>

<template>
  <div>
    <h1 class="text-h5 mb-6">Geospatial Search</h1>

    <v-card class="mb-4 pa-4">
      <v-row>
        <v-col cols="12" md="5">
          <v-text-field
            v-model="latLong"
            label="Coordinates (lat,long)"
            placeholder="38.81,-90.79"
            prepend-inner-icon="mdi-map-marker"
            hint="Click on the map to set coordinates"
            persistent-hint
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

    <!-- Map -->
    <v-card class="mb-4" style="overflow: hidden; border-radius: 8px">
      <div ref="mapContainer" style="height: 450px; width: 100%; background: #1a1a2e" />
    </v-card>

    <v-chip v-if="results.length" class="mb-4" variant="tonal" size="small">
      {{ results.length }} records found
    </v-chip>

    <v-alert v-if="!isLoading && results.length === 0 && latLong" type="info" variant="outlined" class="mb-4">
      No records found in this area. Try increasing the radius.
    </v-alert>

    <RecordCard
      v-for="record in results"
      :key="record.id"
      :record="record"
    />

    <v-snackbar v-model="snackbar" :timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>
