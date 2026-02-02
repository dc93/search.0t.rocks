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
  leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
  }).addTo(map)

  markerGroup = leaflet.layerGroup().addTo(map)

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
      .map(([k, v]) => `<strong style="color:#64748b">${k}:</strong> <span style="font-family:monospace">${v}</span>`)
      .join('<br/>')

    leaflet.marker([lat, lng])
      .bindPopup(`<div style="max-height:200px;overflow:auto;font-size:12px;color:#e2e8f0;background:#111827;padding:8px;border-radius:6px">${popupContent}</div>`, {
        className: 'dark-popup',
      })
      .addTo(markerGroup)
  }

  if (results.value.length > 0) {
    const bounds = markerGroup.getBounds()
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] })
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

onMounted(() => initMap())
</script>

<template>
  <div>
    <div class="page-header">
      <div class="page-title">Geospatial Intelligence</div>
      <div class="page-subtitle">Location-based record discovery and mapping</div>
    </div>

    <v-card class="search-panel pa-4 mb-4" rounded="lg">
      <v-row align="center">
        <v-col cols="12" md="5">
          <v-text-field
            v-model="latLong"
            label="Coordinates (lat,long)"
            placeholder="38.81,-90.79"
            prepend-inner-icon="mdi-crosshairs-gps"
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
            prepend-inner-icon="mdi-radius-outline"
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-btn color="primary" block @click="search" :loading="isLoading">
            <v-icon start size="18">mdi-earth</v-icon>
            Search
          </v-btn>
        </v-col>
        <v-col cols="12" md="2">
          <v-chip v-if="results.length" variant="tonal" color="primary" size="small">
            {{ results.length }} found
          </v-chip>
        </v-col>
      </v-row>
    </v-card>

    <v-card class="mb-4" style="overflow: hidden; border: 1px solid rgba(59,130,246,0.1)" rounded="lg">
      <div ref="mapContainer" style="height: 500px; width: 100%; background: #0a0e17" />
    </v-card>

    <RecordCard v-for="record in results" :key="record.id" :record="record" />

    <v-snackbar v-model="snackbar" :timeout="3000" color="error">{{ snackbarText }}</v-snackbar>
  </div>
</template>
