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
const tips: Record<string, any> = {}
const cyContainer = ref<HTMLElement | null>(null)

function createDocSummary(doc: Record<string, unknown>): string {
  const blacklist = ['id', '_version_', 'line', 'notes']
  return Object.entries(doc)
    .filter(([key]) => !blacklist.includes(key))
    .map(([key, value]) => `<strong>${key}:</strong> ${String(value)}`)
    .join('<br />')
}

function applyLayout() {
  if (cy) {
    cy.layout({ name: selectedLayout.value, minNodeSpacing: 200 }).run()
  }
}

function addDocument(record: Record<string, unknown>) {
  if (!cy) return null
  try {
    const node = cy.add({ group: 'nodes', data: { id: record.id } })
    // Tippy integration would go here in production
    applyLayout()
    return node
  } catch {
    return null
  }
}

function createLink(source: string, target: string) {
  if (!cy) return
  try {
    cy.add({
      group: 'edges',
      data: { id: `${source}-${target}`, source, target },
    })
  } catch {}
}

async function handleNodeClick(nodeId: string) {
  try {
    const data = await $fetch<any>(`/api/documents/${nodeId}`, {
      query: { moreLikeThis: 'true' },
    })

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
  // Dynamic import of Cytoscape (client-only)
  const cytoscape = (await import('cytoscape')).default

  cy = cytoscape({
    container: cyContainer.value,
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#448AFF',
          'label': 'data(id)',
          'font-size': '10px',
          'color': '#fff',
          'text-outline-width': 2,
          'text-outline-color': '#1E1E1E',
        },
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#82B1FF',
          'curve-style': 'bezier',
        },
      },
    ],
    layout: { name: 'circle' },
  })

  cy.on('tap', 'node', (event: any) => {
    handleNodeClick(event.target.data('id'))
  })

  // Load initial node
  if (initialId) {
    const data = await $fetch<any>(`/api/documents/${initialId}`)
    if (data.record) {
      addDocument(data.record)
    }
  }
})

watch(selectedLayout, () => applyLayout())
</script>

<template>
  <div style="position: relative; width: 100%; height: calc(100vh - 120px)">
    <!-- Controls -->
    <v-card
      style="position: absolute; top: 10px; right: 10px; z-index: 10"
      width="350"
      class="pa-3"
    >
      <v-select
        v-model="selectedLayout"
        :items="layoutOptions"
        label="Graph Layout"
        density="compact"
        hide-details
        class="mb-3"
      />
      <v-text-field
        v-model.number="minSimilarity"
        label="Min Similarity Score"
        type="number"
        density="compact"
        hide-details
        class="mb-3"
      />
      <div class="text-caption text-grey">
        Last query: {{ lastQueryCount }} results, {{ lastQueryShown }} shown.
        Lowest score: {{ lowestScore }}.
      </div>
      <div class="text-caption text-grey mt-1">
        Click a node to expand related records.
      </div>
    </v-card>

    <!-- Graph -->
    <div ref="cyContainer" style="width: 100%; height: 100%; background: #121212" />
  </div>
</template>
