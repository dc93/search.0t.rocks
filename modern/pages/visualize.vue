<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const route = useRoute()
const initialId = route.query.id as string

const selectedLayout = ref('circle')
const minSimilarity = ref(10)
const lastQueryCount = ref(0)
const lastQueryShown = ref(0)
const lowestScore = ref(0)

const layoutOptions = [
  { title: 'Cose', value: 'cose' },
  { title: 'Grid', value: 'grid' },
  { title: 'Circle', value: 'circle' },
  { title: 'Concentric', value: 'concentric' },
  { title: 'Breadthfirst', value: 'breadthfirst' },
]

let cy: any = null
const cyContainer = ref<HTMLElement | null>(null)

function applyLayout() {
  if (cy) cy.layout({ name: selectedLayout.value, minNodeSpacing: 200 }).run()
}

function addDocument(record: Record<string, unknown>) {
  if (!cy) return null
  try {
    const node = cy.add({ group: 'nodes', data: { id: record.id } })
    applyLayout()
    return node
  } catch { return null }
}

function createLink(source: string, target: string) {
  if (!cy) return
  try {
    cy.add({ group: 'edges', data: { id: `${source}-${target}`, source, target } })
  } catch {}
}

async function handleNodeClick(nodeId: string) {
  try {
    const data = await $fetch<any>(`/api/documents/${nodeId}`, { query: { moreLikeThis: 'true' } })
    if (data.related) {
      lastQueryCount.value = data.related.length
      let shown = 0
      let lowest = Infinity
      for (const record of data.related) {
        const score = record['similarity score'] ?? 0
        if (score < lowest) lowest = score
        if (score >= minSimilarity.value) {
          addDocument(record)
          createLink(nodeId, record.id)
          shown++
        }
      }
      lastQueryShown.value = shown
      lowestScore.value = lowest === Infinity ? 0 : lowest
    }
  } catch (err) {
    console.error('Error fetching related documents:', err)
  }
}

onMounted(async () => {
  const cytoscape = (await import('cytoscape')).default

  cy = cytoscape({
    container: cyContainer.value,
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#3b82f6',
          'label': 'data(id)',
          'font-size': '9px',
          'color': '#94a3b8',
          'text-outline-width': 2,
          'text-outline-color': '#0a0e17',
          'font-family': 'JetBrains Mono, monospace',
        },
      },
      {
        selector: 'edge',
        style: {
          'width': 1.5,
          'line-color': 'rgba(59, 130, 246, 0.3)',
          'curve-style': 'bezier',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'background-color': '#06b6d4',
          'border-width': 2,
          'border-color': '#06b6d4',
        },
      },
    ],
    layout: { name: 'circle' },
  })

  cy.on('tap', 'node', (event: any) => handleNodeClick(event.target.data('id')))

  if (initialId) {
    const data = await $fetch<any>(`/api/documents/${initialId}`)
    if (data.record) addDocument(data.record)
  }
})

watch(selectedLayout, () => applyLayout())
</script>

<template>
  <div style="position: relative; width: 100%; height: calc(100vh - 120px)">
    <!-- Controls -->
    <v-card
      style="position: absolute; top: 12px; right: 12px; z-index: 10; border: 1px solid rgba(59,130,246,0.1)"
      width="300"
      class="pa-4"
    >
      <div class="d-flex align-center mb-3">
        <v-icon size="18" color="primary" class="mr-2">mdi-graph-outline</v-icon>
        <span style="font-weight: 500; font-size: 0.85rem">Graph Controls</span>
      </div>

      <v-select
        v-model="selectedLayout"
        :items="layoutOptions"
        label="Layout"
        density="compact"
        hide-details
        class="mb-3"
      />
      <v-text-field
        v-model.number="minSimilarity"
        label="Min Similarity"
        type="number"
        density="compact"
        hide-details
        class="mb-3"
      />

      <div style="font-size: 0.7rem; color: #475569; line-height: 1.6">
        <div>Results: {{ lastQueryCount }} | Shown: {{ lastQueryShown }}</div>
        <div>Lowest score: {{ lowestScore }}</div>
        <div class="mt-1" style="color: #334155">Click a node to expand relationships</div>
      </div>
    </v-card>

    <!-- Graph -->
    <div ref="cyContainer" style="width: 100%; height: 100%; background: #0a0e17" />
  </div>
</template>
