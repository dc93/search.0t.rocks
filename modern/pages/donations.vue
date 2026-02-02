<script setup lang="ts">
interface Donation {
  name: string
  amount: number
  message?: string
}

const { data } = await useFetch<Donation[]>('/api/donations')
</script>

<template>
  <div>
    <div class="page-header">
      <div class="page-title">Supporters</div>
      <div class="page-subtitle">Thank you to everyone who has supported this project</div>
    </div>

    <v-card v-if="!data || data.length === 0" class="pa-8 text-center">
      <v-icon size="48" color="#1e293b" class="mb-3">mdi-hand-heart-outline</v-icon>
      <div style="color: #475569; font-size: 0.875rem">No donations yet.</div>
    </v-card>

    <v-card v-else class="ti-table">
      <v-table density="comfortable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Amount</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(donation, i) in data" :key="i">
            <td style="font-weight: 500">{{ donation.name }}</td>
            <td class="mono" style="color: #10b981">${{ donation.amount.toFixed(2) }}</td>
            <td style="color: #64748b">{{ donation.message || '—' }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </div>
</template>
