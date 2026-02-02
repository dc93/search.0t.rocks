<script setup lang="ts">
const faqs = [
  { q: 'How do I remove my data?', a: 'Contact the administrator via email to request removal of your data.' },
  { q: 'Where does this data come from?', a: 'All data is compiled from publicly available sources and data breaches that have been shared in the public domain.' },
  { q: 'How do credits work?', a: 'Credits are used for bulk data exports. 1 USD = 100 credits. The first 100 records per export are free. After that, 1 credit = 10 records.' },
  { q: 'How do I get API access?', a: 'Contact the administrator to request a free API token.' },
  { q: 'What is the visualization tool?', a: 'The Graph Explorer shows relationships between records as an interactive graph. Click on any node to expand and discover linked records.' },
]
</script>

<template>
  <div>
    <div class="page-header">
      <div class="page-title">Frequently Asked Questions</div>
      <div class="page-subtitle">Common questions about the platform</div>
    </div>

    <v-expansion-panels variant="accordion">
      <v-expansion-panel
        v-for="(faq, i) in faqs"
        :key="i"
        style="background: #111827; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 4px"
      >
        <v-expansion-panel-title style="font-weight: 500; font-size: 0.9rem">
          <v-icon size="16" color="primary" class="mr-3">mdi-help-circle-outline</v-icon>
          {{ faq.q }}
        </v-expansion-panel-title>
        <v-expansion-panel-text style="color: #94a3b8; font-size: 0.875rem">
          {{ faq.a }}
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>
