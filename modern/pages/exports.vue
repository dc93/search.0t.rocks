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
  { title: 'Download', key: 'actions', sortable: false },
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
    snackbarText.value = `Not enough credits. You need ${cost.toFixed(1)} but have ${credits.value}.`
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
      body: {
        walletId: walletId.value,
        exportCount: exportCount.value,
      },
    })

    if (data.success) {
      snackbarText.value = 'Export started! Check back soon.'
      snackbar.value = true
      exports.value.push({
        ...data,
        exportCount: exportCount.value,
        status: 'started',
      })
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
  if (item.link) {
    window.open(item.link, '_blank')
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'complete': return 'success'
    case 'failed': return 'error'
    case 'started': return 'warning'
    default: return 'grey'
  }
}

onMounted(() => {
  if (route.query.url && typeof route.query.url === 'string') {
    try {
      exportUrl.value = decodeURIComponent(route.query.url)
      showExportDialog.value = true
    } catch {
      // Invalid URL encoding
    }
  }

  const unwatch = watch(walletId, (val) => {
    if (val) {
      fetchExports()
      unwatch()
    }
  }, { immediate: true })
})

// Refresh exports periodically
let refreshInterval: ReturnType<typeof setInterval>
onMounted(() => {
  refreshInterval = setInterval(fetchExports, 15000)
})
onUnmounted(() => {
  clearInterval(refreshInterval)
})
</script>

<template>
  <div>
    <div class="d-flex align-center mb-6">
      <h1 class="text-h5">Database Exports</h1>
      <v-spacer />
      <v-btn color="primary" @click="showExportDialog = true">
        <v-icon start>mdi-plus</v-icon>
        New Export
      </v-btn>
    </div>

    <v-card>
      <v-card-title class="d-flex align-center">
        Exports List
        <v-spacer />
        <v-progress-circular v-if="isFetching" indeterminate size="20" width="2" class="ml-2" />
      </v-card-title>

      <template v-if="exports.length === 0 && !isFetching">
        <v-card-text>
          <v-alert type="info" variant="outlined">
            No exports yet. Use the search page and click "Export More" to create one.
          </v-alert>
        </v-card-text>
      </template>

      <v-data-table
        v-else
        :items="exports"
        :headers="headers"
        :items-per-page="10"
        class="elevation-0"
      >
        <template #item.status="{ item }">
          <v-chip :color="getStatusColor(item.status)" size="small" variant="tonal">
            {{ item.status }}
          </v-chip>
        </template>
        <template #item.query="{ item }">
          <span class="text-truncate" style="max-width: 300px; display: inline-block">
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
            <v-icon start size="small">mdi-download</v-icon>
            Download
          </v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- New Export Dialog -->
    <v-dialog v-model="showExportDialog" max-width="500">
      <v-card>
        <v-card-title>New Export</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="exportUrl"
            label="Search URL"
            placeholder="Paste the search results URL here"
            prepend-inner-icon="mdi-link"
            class="mb-4"
          />
          <v-text-field
            v-model.number="exportCount"
            label="Record Count"
            type="number"
            prepend-inner-icon="mdi-numeric"
            hint="First 100 records are free. 1 credit = 10 records."
            persistent-hint
          />
          <v-alert
            v-if="exportCount > 100"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-4"
          >
            Cost: {{ ((exportCount - 100) / 10).toFixed(1) }} credits
            (you have {{ credits }} credits)
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-btn color="error" @click="showExportDialog = false">Cancel</v-btn>
          <v-spacer />
          <v-btn color="primary" @click="doExport" :loading="isLoading">Export</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>
