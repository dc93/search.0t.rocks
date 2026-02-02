<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useWallet } from '~/composables/useWallet'
import type { ExportJob } from '~/types'

const { walletId, credits } = useWallet()
const route = useRoute()

const showExportDialog = ref(false)
const exportUrl = ref('')
const exportCount = ref(200)
const exports = ref<ExportJob[]>([])
const isLoading = ref(false)
const isFetching = ref(false)
const snackbar = ref(false)
const snackbarText = ref('')

const headers = [
  { title: 'Export ID', key: 'jobid', sortable: false },
  { title: 'Status', key: 'status' },
  { title: 'Query', key: 'query', sortable: false },
  { title: 'Records', key: 'exportCount' },
  { title: 'Actions', key: 'actions', sortable: false },
]

async function fetchExports() {
  if (!walletId.value) return
  isFetching.value = true
  try {
    const data = await $fetch<ExportJob[]>(`/api/exports/${walletId.value}`)
    exports.value = data
  } catch {
    snackbarText.value = 'Failed to load exports.'
    snackbar.value = true
  } finally {
    isFetching.value = false
  }
}

async function doExport() {
  if (walletId.value.length !== 36) {
    snackbarText.value = 'Invalid wallet ID'
    snackbar.value = true
    return
  }
  if (exportCount.value > 100000) {
    snackbarText.value = 'Max 100,000 records per export'
    snackbar.value = true
    return
  }
  const cost = (exportCount.value - 100) / 10
  if (exportCount.value > 100 && credits.value < cost) {
    snackbarText.value = `Not enough credits. Need ${cost.toFixed(1)}, have ${credits.value}.`
    snackbar.value = true
    return
  }
  if (!exportUrl.value) {
    snackbarText.value = 'Paste a search URL first.'
    snackbar.value = true
    return
  }
  isLoading.value = true
  try {
    let searchParams: string
    try {
      const sourceUrl = new URL(exportUrl.value)
      searchParams = sourceUrl.searchParams.toString()
    } catch {
      snackbarText.value = 'Invalid URL format.'
      snackbar.value = true
      return
    }
    const data = await $fetch<ExportJob & { success?: boolean }>(`/api/export?${searchParams}`, {
      method: 'POST',
      body: { walletId: walletId.value, exportCount: exportCount.value },
    })
    if (data.success) {
      snackbarText.value = 'Export started!'
      snackbar.value = true
      exports.value.push({ ...data, exportCount: exportCount.value, status: 'started' })
      showExportDialog.value = false
      exportUrl.value = ''
      exportCount.value = 200
    }
  } catch {
    snackbarText.value = 'Export failed. Credits not deducted.'
    snackbar.value = true
  } finally {
    isLoading.value = false
  }
}

function downloadExport(item: ExportJob) {
  if (item.link) window.open(item.link, '_blank')
}

function getStatusColor(status: string) {
  switch (status) {
    case 'complete': return 'success'
    case 'failed': return 'error'
    case 'started': return 'warning'
    default: return 'secondary'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'complete': return 'mdi-check-circle-outline'
    case 'failed': return 'mdi-alert-circle-outline'
    case 'started': return 'mdi-progress-clock'
    default: return 'mdi-help-circle-outline'
  }
}

onMounted(() => {
  if (route.query.url && typeof route.query.url === 'string') {
    try {
      exportUrl.value = decodeURIComponent(route.query.url)
      showExportDialog.value = true
    } catch {}
  }
  const unwatch = watch(walletId, (val) => {
    if (val) { fetchExports(); unwatch() }
  }, { immediate: true })
})

let refreshInterval: ReturnType<typeof setInterval>
onMounted(() => { refreshInterval = setInterval(fetchExports, 15000) })
onUnmounted(() => { clearInterval(refreshInterval) })
</script>

<template>
  <div>
    <div class="page-header d-flex align-center">
      <div>
        <div class="page-title">Data Exports</div>
        <div class="page-subtitle">Bulk export search results for offline analysis</div>
      </div>
      <v-spacer />
      <v-btn color="primary" @click="showExportDialog = true">
        <v-icon start size="18">mdi-plus</v-icon>
        New Export
      </v-btn>
    </div>

    <v-card>
      <div class="pa-4 d-flex align-center" style="border-bottom: 1px solid rgba(255,255,255,0.04)">
        <v-icon size="18" color="primary" class="mr-2">mdi-database-export-outline</v-icon>
        <span style="font-weight: 500; font-size: 0.875rem">Export History</span>
        <v-spacer />
        <v-progress-circular v-if="isFetching" indeterminate size="16" width="2" color="primary" />
      </div>

      <div v-if="exports.length === 0 && !isFetching" class="pa-6 text-center" style="color: #475569">
        <v-icon size="48" color="#1e293b" class="mb-3">mdi-database-export-outline</v-icon>
        <div style="font-size: 0.875rem">No exports yet</div>
        <div style="font-size: 0.75rem; color: #334155" class="mt-1">
          Search for records and click "Export" to create one
        </div>
      </div>

      <div v-else class="ti-table">
        <v-data-table
          :items="exports"
          :headers="headers"
          :items-per-page="10"
          class="elevation-0"
        >
          <template #item.jobid="{ item }">
            <span class="mono" style="font-size: 0.8rem">{{ item.jobid?.substring(0, 8) }}...</span>
          </template>
          <template #item.status="{ item }">
            <v-chip :color="getStatusColor(item.status)" size="small" variant="tonal">
              <v-icon start size="14">{{ getStatusIcon(item.status) }}</v-icon>
              {{ item.status }}
            </v-chip>
          </template>
          <template #item.query="{ item }">
            <span class="mono text-truncate" style="max-width: 300px; display: inline-block; font-size: 0.8rem">
              {{ item.query }}
            </span>
          </template>
          <template #item.actions="{ item }">
            <v-btn
              :disabled="item.status !== 'complete'"
              color="primary"
              size="small"
              variant="tonal"
              @click="downloadExport(item)"
            >
              <v-icon start size="14">mdi-download</v-icon>
              Download
            </v-btn>
          </template>
        </v-data-table>
      </div>
    </v-card>

    <!-- New Export Dialog -->
    <v-dialog v-model="showExportDialog" max-width="500">
      <v-card style="border: 1px solid rgba(59,130,246,0.15)">
        <div class="pa-4 d-flex align-center" style="border-bottom: 1px solid rgba(255,255,255,0.04)">
          <v-icon color="primary" class="mr-2">mdi-database-export-outline</v-icon>
          <span style="font-weight: 500">New Export</span>
        </div>
        <v-card-text class="pt-4">
          <v-text-field
            v-model="exportUrl"
            label="Search URL"
            placeholder="Paste the search results URL"
            prepend-inner-icon="mdi-link"
            class="mb-4"
          />
          <v-text-field
            v-model.number="exportCount"
            label="Record Count"
            type="number"
            prepend-inner-icon="mdi-numeric"
            hint="First 100 free. 1 credit = 10 records."
            persistent-hint
          />
          <v-alert v-if="exportCount > 100" type="info" variant="tonal" density="compact" class="mt-4">
            Cost: {{ ((exportCount - 100) / 10).toFixed(1) }} credits
            (balance: {{ credits }})
          </v-alert>
        </v-card-text>
        <v-card-actions class="pa-4" style="border-top: 1px solid rgba(255,255,255,0.04)">
          <v-btn variant="text" @click="showExportDialog = false" style="color: #64748b">Cancel</v-btn>
          <v-spacer />
          <v-btn color="primary" @click="doExport" :loading="isLoading">
            <v-icon start size="16">mdi-rocket-launch-outline</v-icon>
            Start Export
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="3000">{{ snackbarText }}</v-snackbar>
  </div>
</template>
