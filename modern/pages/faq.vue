<script setup lang="ts">
const faqs = [
  {
    q: 'How do I remove my data?',
    a: 'Contact the administrator via email to request removal of your data.',
  },
  {
    q: 'Where does this data come from?',
    a: 'All data is compiled from publicly available sources and data breaches that have been shared in the public domain.',
  },
  {
    q: 'How do credits work?',
    a: 'Credits are used for bulk data exports. 1 USD = 100 credits. The first 100 records per export are free. After that, 1 credit = 10 records.',
  },
  {
    q: 'How do I get API access?',
    a: 'Contact the administrator to request a free API token.',
  },
  {
    q: 'What is the visualization tool?',
    a: 'The visualizer shows relationships between records as an interactive graph. Click on any node to expand and discover linked records.',
  },
]
</script>

<template>
  <div>
    <h1 class="text-h5 mb-6">Frequently Asked Questions</h1>

    <v-expansion-panels variant="accordion">
      <v-expansion-panel v-for="(faq, i) in faqs" :key="i">
        <v-expansion-panel-title>{{ faq.q }}</v-expansion-panel-title>
        <v-expansion-panel-text>{{ faq.a }}</v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>
